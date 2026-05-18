import 'package:caci_hub/modules/auth/domain/enums/user_role.dart';
import 'package:caci_hub/modules/auth/domain/entities/auth_user.dart';

abstract interface class IAuthRepository {
  // ── Current session ──────────────────────────────────────
  AuthUser? get currentUser;
  Stream<AuthUser?> get authStateChanges;

  // ── Email & password ─────────────────────────────────────
  Future<void> signInWithEmail({
    required String email,
    required String password,
  });
  Future<void> sendPasswordResetEmail(String email);
  Future<void> updatePassword(String newPassword);
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  });

  // ── Google OAuth ─────────────────────────────────────────
  Future<void> signInWithGoogle();

  // ── Phone OTP ────────────────────────────────────────────
  Future<void> sendPhoneOtp(String phone);
  Future<void> resendPhoneOtp(String phone);
  Future<void> verifyPhoneOtp({required String phone, required String token});

  // ── TOTP MFA ─────────────────────────────────────────────
  Future<AuthUser> verifyTotp(String code);
  Future<void> refreshCurrentUser();

  // ── TOTP Enrollment ───────────────────────────────────────
  Future<({String factorId, String qrCodeUrl, String secret})> enrollTotp();
  Future<void> unenrollTotp(String factorId);

  // ── Access Request ───────────────────────────────────────
  Future<void> requestAccess({
    required String fullName,
    required String email,
    required String? memberId,
    required String assembly,
    required String role,
  });

  // ── Profile Management ───────────────────────────────────
  Future<AuthUser> loadProfile(String userId);
  Future<AuthUser> updateProfile({String? fullName, UserRole? newRole});
  Future<String> requestRoleChange(UserRole requestedRole);

  // ── GDPR / Account Management ───────────────────────────
  Future<void> deleteAccount();

  // ── Session ──────────────────────────────────────────────
  Future<void> signOut();

  // NOTE: clearPersistedSession performs a local-scope sign-out, which
  // removes the locally stored session without invalidating the server
  // session. Use signOut() for a full sign-out.
  Future<void> clearPersistedSession();
}
