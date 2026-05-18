import 'package:supabase_flutter/supabase_flutter.dart' hide AuthUser;
import 'package:caci_hub/core/errors/errors.dart';

class SupabaseAuthDataSource {
  SupabaseAuthDataSource(this._client, this._logger);

  final SupabaseClient _client;
  final AppLogger _logger;

  SupabaseClient get _supabase => _client;
  GoTrueClient get _auth => _client.auth;

  // ── Session ───────────────────────────────────────────────────────────────

  Session? get currentSession => _auth.currentSession;
  User? get currentSupabaseUser => _auth.currentUser;
  Stream<AuthState> get authStateChanges => _auth.onAuthStateChange;

  // ── Email & password ──────────────────────────────────────────────────────

  Future<AuthResponse> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      final res = await _auth.signInWithPassword(
        email: email,
        password: password,
      );
      _logger.logSuccess(AppSuccessCode.signIn, 'User signed in: $email');
      return res;
    } on AuthException catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.incorrectPassword,
          message: 'Sign in failed for $email: ${e.message}',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _auth.resetPasswordForEmail(
        email,
        redirectTo: 'http://localhost:8080/reset-password',
      );
      _logger.logSuccess(
        AppSuccessCode.passwordChanged,
        'Password reset email sent: $email',
      );
    } on AuthException catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.authUnexpected,
          message: 'Failed to send password reset for $email: ${e.message}',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  Future<UserResponse> updatePassword(String newPassword) async {
    try {
      final res = await _auth.updateUser(UserAttributes(password: newPassword));
      _logger.logSuccess(
        AppSuccessCode.passwordChanged,
        'Password updated for current user',
      );
      return res;
    } on AuthException catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.profileUpdateFailed,
          message: 'Failed to update password: ${e.message}',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  Stream<AuthChangeEvent> get authEvents =>
      _auth.onAuthStateChange.map((e) => e.event);

  // ── Google OAuth ──────────────────────────────────────────────────────────

  Future<bool> signInWithGoogle() async {
    try {
      final res = await _auth.signInWithOAuth(OAuthProvider.google);
      _logger.logSuccess(AppSuccessCode.signIn, 'Google sign-in initiated');
      return res;
    } on AuthException catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.authUnexpected,
          message: 'Google sign-in failed: ${e.message}',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  // ── Phone OTP ─────────────────────────────────────────────────────────────

  Future<void> sendPhoneOtp(String phone) async {
    try {
      await _auth.signInWithOtp(phone: phone);
      _logger.logSuccess(AppSuccessCode.otpSent, 'OTP sent to $phone');
    } on AuthException catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.phoneProviderDisabled,
          message: 'Failed to send OTP to $phone: ${e.message}',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  Future<AuthResponse> verifyPhoneOtp({
    required String phone,
    required String token,
  }) async {
    try {
      final res = await _auth.verifyOTP(
        phone: phone,
        token: token,
        type: OtpType.sms,
      );
      _logger.logSuccess(
        AppSuccessCode.otpVerified,
        'Phone OTP verified for $phone',
      );
      return res;
    } on AuthException catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.invalidOtp,
          message: 'Phone OTP verification failed for $phone: ${e.message}',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  // ── TOTP MFA ──────────────────────────────────────────────────────────────

  Future<AuthMFAVerifyResponse> verifyTotp(String code) async {
    try {
      final factors = await _auth.mfa.listFactors();
      final totpFactors = factors.totp;

      if (totpFactors.isEmpty) {
        throw AuthException('No TOTP factor enrolled for this account.');
      }
      final totp = totpFactors.first;
      _logger.logSuccess(
        AppSuccessCode.mfaFactorListed,
        'TOTP factor id: ${totp.id}, status: ${totp.status}',
      );

      final challenge = await _auth.mfa.challenge(factorId: totp.id);
      _logger.logSuccess(
        AppSuccessCode.mfaChallengeCreated,
        'Challenge id: ${challenge.id}',
      );

      return _auth.mfa.verify(
        factorId: totp.id,
        challengeId: challenge.id,
        code: code,
      );
    } on AuthException catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.authUnexpected,
          message: 'MFA error: ${e.message} | status: ${e.statusCode}',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  // ── TOTP Enrollment ───────────────────────────────────────────────────────

  Future<AuthMFAEnrollResponse> enrollTotp() async {
    try {
      final res = await _auth.mfa.enroll(
        factorType: FactorType.totp,
        issuer: 'CACI Hub',
      );
      _logger.logSuccess(
        AppSuccessCode.mfaEnrolled,
        'TOTP enrollment initiated: ${res.id}',
      );
      return res;
    } on AuthException catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.authUnexpected,
          message: 'TOTP enrollment failed: ${e.message}',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  Future<void> unenrollTotp(String factorId) async {
    try {
      await _auth.mfa.unenroll(factorId); // positional, not named
      _logger.logSuccess(
        AppSuccessCode.mfaUnenrolled,
        'MFA factor unenrolled: $factorId',
      );
    } on AuthException catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.authUnexpected,
          message: 'MFA unenrollment failed for $factorId: ${e.message}',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  /// Returns true if the current user has at least one verified TOTP factor.
  Future<bool> hasTotpEnrolled() async {
    try {
      final factors = await _auth.mfa.listFactors();
      final enrolled = factors.totp.any(
        (f) => f.status == FactorStatus.verified,
      );
      _logger.logSuccess(
        AppSuccessCode.profileFetched,
        'MFA status checked: enrolled=$enrolled',
      );
      return enrolled;
    } catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.authUnexpected,
          message: 'Failed to check MFA status: $e',
          cause: e,
        ),
      );
      return false;
    }
  }

  // ── Profile (Postgres) ────────────────────────────────────────────────────
  Future<Map<String, dynamic>> fetchProfile(String userId) async {
    try {
      final data = await _supabase
          .from('user_profiles')
          .select()
          .eq('id', userId)
          .single();
      _logger.logSuccess(
        AppSuccessCode.profileFetched,
        'Profile fetched for $userId',
      );
      return data;
    } on PostgrestException catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.serverError,
          message: 'Postgres error fetching profile for $userId (Code: ${e.code}): ${e.message}',
          cause: e,
        ),
      );
      rethrow;
    } catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.serverError,
          message: 'Failed to fetch profile for $userId: $e',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  Future<Map<String, dynamic>> updateProfile(
    Map<String, dynamic> fields,
  ) async {
    final userId = _auth.currentUser!.id;
    try {
      final data = await _supabase
          .from('user_profiles')
          .update(fields)
          .eq('id', userId)
          .select()
          .single();
      _logger.logSuccess(
        AppSuccessCode.profileUpdated,
        'Profile updated for $userId',
      );
      return data;
    } catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.profileUpdateFailed,
          message: 'Failed to update profile for $userId: $e',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  Future<String> insertRoleChangeRequest({
    required String userId,
    required String requestedRole,
  }) async {
    try {
      final data = await _supabase
          .from('role_change_requests')
          .insert({
            'user_id': userId,
            'requested_role': requestedRole,
            'status': 'pending',
            'created_at': DateTime.now().toIso8601String(),
          })
          .select('id')
          .single();
      _logger.logSuccess(
        AppSuccessCode.roleChangeRequested,
        'Role change to $requestedRole requested for $userId',
      );
      return data['id'] as String;
    } catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.serverError,
          message: 'Failed to insert role change request for $userId: $e',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  Future<void> insertAccessRequest(Map<String, dynamic> payload) async {
    try {
      await _supabase.from('access_requests').insert(payload);
      _logger.logSuccess(
        AppSuccessCode.accessRequested,
        'Access request submitted for ${payload['email']}',
      );
    } catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.serverError,
          message: 'Failed to submit access request: $e',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  // ── Account ───────────────────────────────────────────────────────────────

  Future<void> deleteAccount() async {
    try {
      await _supabase.functions.invoke('delete-account');
      _logger.logSuccess(
        AppSuccessCode.accountDeleted,
        'Account deletion triggered',
      );
    } catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.accountDeletionFailed,
          message: 'Account deletion failed: $e',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  Future<void> signOut() async {
    try {
      await _auth.signOut();
      _logger.logSuccess(AppSuccessCode.signOut, 'User signed out globally');
    } catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.authUnexpected,
          message: 'Sign out failed: $e',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  // ── Session persistence ───────────────────────────────────────────────────

  Future<AuthResponse> setSession(String accessToken) async {
    try {
      final res = await _auth.setSession(accessToken);
      _logger.logSuccess(
        AppSuccessCode.sessionRestored,
        'Session restored via access token',
      );
      return res;
    } on AuthException catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.authUnexpected,
          message: 'Failed to set session: ${e.message}',
          cause: e,
        ),
      );
      rethrow;
    }
  }

  Future<void> clearSession() async {
    try {
      await _auth.signOut(scope: SignOutScope.local);
      _logger.logSuccess(AppSuccessCode.signOut, 'Local session cleared');
    } catch (e) {
      _logger.log(
        AppError(
          errorCode: AppErrorCode.authUnexpected,
          message: 'Failed to clear local session: $e',
          cause: e,
        ),
      );
      rethrow;
    }
  }
}
