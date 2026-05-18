import 'dart:async';

import 'package:caci_hub/modules/auth/infrastructure/datasources/auth_datasource.dart';
import 'package:caci_hub/modules/auth/domain/enums/user_role.dart';
import 'package:caci_hub/modules/auth/domain/exceptions/auth_exceptions.dart';
import 'package:caci_hub/modules/auth/domain/entities/auth_user.dart';
import 'package:caci_hub/modules/auth/domain/repositories/i_auth_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart'
    hide AuthState, AuthUser, AuthException, UserResponse;
import 'package:supabase_flutter/supabase_flutter.dart'
    as sb
    show AuthException, User;

class AuthRepository implements IAuthRepository {
  AuthRepository(this._ds);

  final SupabaseAuthDataSource _ds;

  // ── Cached user ───────────────────────────────────────────────────────────

  AuthUser? _cachedUser;

  @override
  AuthUser? get currentUser => _cachedUser;

  // ── Auth state stream ─────────────────────────────────────────────────────

  Stream<AuthUser?>? _broadcastAuthState;

  @override
  Stream<AuthUser?> get authStateChanges {
    _broadcastAuthState ??= _ds.authStateChanges.asyncMap((event) async {
      final sb.User? sbUser = event.session?.user;
      if (sbUser == null) {
        _cachedUser = null;
        return null;
      }

      // If we already have the profile for this user ID, just return it.
      // This prevents the "Refresh session" -> "fetchProfile" loop logs.
      if (_cachedUser?.id == sbUser.id) {
        return _cachedUser;
      }

      try {
        _cachedUser = await _hydrateProfile(
          sbUser.id,
          isMfaVerified: sbUser.appMetadata['amr']?.contains('mfa') ?? false,
        );
        return _cachedUser;
      } catch (_) {
        return null;
      }
    }).asBroadcastStream();

    return _broadcastAuthState!;
  }

  // ── Email & password ──────────────────────────────────────────────────────

  @override
  Future<void> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      final res = await _ds.signInWithEmail(email: email, password: password);
      final sbUser = res.user;
      if (sbUser == null) throw const UnexpectedAuthException();
      await _hydrateProfile(sbUser.id);
    } on sb.AuthException catch (e) {
      throw _mapAuthException(e);
    }
  }

  @override
  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _ds.sendPasswordResetEmail(email);
    } on sb.AuthException catch (e) {
      throw _mapAuthException(e);
    }
  }

  @override
  Future<void> updatePassword(String newPassword) async {
    try {
      await _ds.updatePassword(newPassword);
    } on sb.AuthException catch (e) {
      throw _mapAuthException(e);
    }
  }

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final sb.User? sbUser = _ds.currentSupabaseUser;
    if (sbUser == null) throw const UserNotAuthenticatedException();

    final email = sbUser.email;
    if (email == null) throw const UserNotAuthenticatedException();

    try {
      await _ds.signInWithEmail(email: email, password: currentPassword);
    } on sb.AuthException catch (e) {
      final msg = e.message.toLowerCase();
      if (msg.contains('invalid') || msg.contains('credentials')) {
        throw const IncorrectPasswordException();
      }
      throw _mapAuthException(e);
    }

    try {
      await _ds.updatePassword(newPassword);
    } on sb.AuthException catch (e) {
      throw _mapAuthException(e);
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────

  @override
  Future<void> signInWithGoogle() async {
    try {
      await _ds.signInWithGoogle();
    } on sb.AuthException catch (e) {
      throw _mapAuthException(e);
    }
  }

  // ── Phone OTP ─────────────────────────────────────────────────────────────

  @override
  Future<void> sendPhoneOtp(String phone) async {
    try {
      await _ds.sendPhoneOtp(phone);
    } on sb.AuthException catch (e) {
      final msg = e.message.toLowerCase();
      if (msg.contains('not enabled') || msg.contains('provider')) {
        throw const PhoneProviderNotConfiguredException();
      }
      if (msg.contains('rate') || msg.contains('too many')) {
        throw const RateLimitException();
      }
      throw _mapAuthException(e);
    }
  }

  @override
  Future<void> resendPhoneOtp(String phone) => sendPhoneOtp(phone);

  @override
  Future<void> verifyPhoneOtp({
    required String phone,
    required String token,
  }) async {
    try {
      final res = await _ds.verifyPhoneOtp(phone: phone, token: token);
      final sbUser = res.user;
      if (sbUser == null) throw const UserNotFoundAfterAuthException();
      await _hydrateProfile(sbUser.id);
    } on sb.AuthException catch (e) {
      final msg = e.message.toLowerCase();
      if (msg.contains('otp') ||
          msg.contains('token') ||
          msg.contains('expired')) {
        throw const InvalidOtpException();
      }
      throw _mapAuthException(e);
    }
  }

  // ── TOTP MFA ──────────────────────────────────────────────────────────────

  @override
  Future<AuthUser> verifyTotp(String code) async {
    try {
      await _ds.verifyTotp(code);
      final sbUser = _ds.currentSupabaseUser;
      if (sbUser == null) throw const UserNotAuthenticatedException();
      return await _hydrateProfile(sbUser.id, isMfaVerified: true);
    } on sb.AuthException catch (e) {
      final msg = e.message.toLowerCase();
      if (msg.contains('invalid') ||
          msg.contains('mfa') ||
          msg.contains('code')) {
        throw const InvalidOtpException();
      }
      throw _mapAuthException(e);
    }
  }

  @override
  Future<void> refreshCurrentUser() async {
    final sbUser = _ds.currentSupabaseUser;
    if (sbUser == null) return;
    await _hydrateProfile(sbUser.id);
  }

  @override
  Future<({String factorId, String qrCodeUrl, String secret})>
  enrollTotp() async {
    try {
      final res = await _ds.enrollTotp();
      final totp = res.totp;
      if (totp == null) throw const UnexpectedAuthException();
      return (factorId: res.id, qrCodeUrl: totp.qrCode, secret: totp.secret);
    } on sb.AuthException catch (e) {
      throw _mapAuthException(e);
    }
  }

  @override
  Future<void> unenrollTotp(String factorId) async {
    try {
      await _ds.unenrollTotp(factorId);
    } on sb.AuthException catch (e) {
      throw _mapAuthException(e);
    }
  }

  // ── Access request ────────────────────────────────────────────────────────

  @override
  Future<void> requestAccess({
    required String fullName,
    required String email,
    required String? memberId,
    required String assembly,
    required String role,
  }) async {
    try {
      await _ds.insertAccessRequest({
        'full_name': fullName,
        'email': email,
        'member_id': memberId,
        'assembly': assembly,
        'role': role,
        'status': 'pending',
        'created_at': DateTime.now().toIso8601String(),
      });
    } catch (_) {
      throw const UnexpectedAuthException();
    }
  }

  // ── Profile management ────────────────────────────────────────────────────

  @override
  Future<AuthUser> loadProfile(String userId) => _hydrateProfile(userId);

  @override
  Future<AuthUser> updateProfile({String? fullName, UserRole? newRole}) async {
    try {
      final fields = <String, dynamic>{
        'full_name':? fullName,
        'role':? newRole?.name,
        'updated_at': DateTime.now().toIso8601String(),
      };
      final data = await _ds.updateProfile(fields);
      final sbUser = _ds.currentSupabaseUser!;
      _cachedUser = _mapProfile(sbUser, data);
      return _cachedUser!;
    } catch (e) {
      throw ProfileUpdateException(e.toString());
    }
  }

  @override
  Future<String> requestRoleChange(UserRole requestedRole) async {
    final userId = _ds.currentSupabaseUser?.id;
    if (userId == null) throw const UserNotAuthenticatedException();
    try {
      return await _ds.insertRoleChangeRequest(
        userId: userId,
        requestedRole: requestedRole.name,
      );
    } catch (_) {
      throw const UnexpectedAuthException();
    }
  }

  // ── Account ───────────────────────────────────────────────────────────────

  @override
  Future<void> deleteAccount() async {
    try {
      await _ds.deleteAccount();
      _cachedUser = null;
    } catch (e) {
      throw AccountDeletionException(e.toString());
    }
  }

  @override
  Future<void> signOut() async {
    await _ds.signOut();
    _cachedUser = null;
  }

  @override
  Future<void> clearPersistedSession() => _ds.clearSession();

  // ── Private helpers ───────────────────────────────────────────────────────

  // After sign-in, check whether the user already has a verified TOTP factor
  // so the router knows to show TotpScreen (verify) vs TotpEnrollScreen (enroll).
  Future<AuthUser> _hydrateProfile(
    String userId, {
    bool isMfaVerified = false,
  }) async {
    try {
      final data = await _ds.fetchProfile(userId);
      final sb.User sbUser = _ds.currentSupabaseUser!;

      // Check for an existing verified TOTP factor
      final enrolled = await _ds.hasTotpEnrolled();

      _cachedUser = _mapProfile(
        sbUser,
        data,
        isMfaVerified: isMfaVerified,
        isMfaEnrolled: enrolled,
      );
      return _cachedUser!;
    } on PostgrestException catch (e) {
      if (e.code == 'PGRST116') throw const ProfileNotProvisionedException();
      rethrow;
    }
  }

  AuthUser _mapProfile(
    sb.User sbUser,
    Map<String, dynamic> profile, {
    bool isMfaVerified = false,
    bool isMfaEnrolled = false,
  }) {
    final roleStr = profile['role'] as String?;
    final role = roleStr != null
        ? UserRole.tryFromJson(roleStr) ?? UserRole.member
        : UserRole.member;

    return AuthUser(
      id: sbUser.id,
      email: sbUser.email,
      phone: sbUser.phone,
      fullName: profile['full_name'] as String? ?? '',
      role: role,
      assemblyId: profile['assembly_id'] as String?,
      isMfaVerified: isMfaVerified,
      isMfaEnrolled: isMfaEnrolled,
    );
  }

  // NOTE: 'invalid' is intentionally broad — a wrong email also returns
  // IncorrectPasswordException. Deliberate: we do not confirm whether an
  // email exists in the system.
  Exception _mapAuthException(sb.AuthException e) {
    final msg = e.message.toLowerCase();
    if (msg.contains('rate') || msg.contains('too many')) {
      return const RateLimitException();
    }
    if (msg.contains('invalid') ||
        msg.contains('credentials') ||
        msg.contains('password')) {
      return const IncorrectPasswordException();
    }
    if (msg.contains('not found') || msg.contains('no user')) {
      return const UserNotFoundAfterAuthException();
    }
    if (msg.contains('mfa') || msg.contains('aal')) {
      return const MfaRequiredException();
    }
    if (msg.contains('refresh_token_already_used')) {
      return const SessionExpiredException();
    }
    return const UnexpectedAuthException();
  }
}
