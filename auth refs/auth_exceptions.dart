import 'package:caci_hub/core/errors/app_error_code.dart';
import 'package:caci_hub/core/errors/app_exception.dart';

class InvalidOtpException extends AppException {
  const InvalidOtpException()
      : super(
          'Invalid or expired OTP. Please try again.',
          errorCode: AppErrorCode.invalidOtp,
        );
}

class ProfileNotProvisionedException extends AppException {
  const ProfileNotProvisionedException()
      : super(
          'Your account is not set up yet. Please contact your administrator.',
          errorCode: AppErrorCode.profileNotProvisioned,
        );
}

class MfaRequiredException extends AppException {
  const MfaRequiredException()
      : super(
          'MFA verification required.',
          errorCode: AppErrorCode.mfaRequired,
        );
}

class RateLimitException extends AppException {
  const RateLimitException()
      : super(
          'Too many attempts. Please try again in 15 minutes.',
          errorCode: AppErrorCode.rateLimit,
        );
}

class PhoneProviderNotConfiguredException extends AppException {
  const PhoneProviderNotConfiguredException()
      : super(
          'Phone sign-in is not configured. Please contact your administrator.',
          errorCode: AppErrorCode.phoneProviderDisabled,
        );
}

/// Thrown when credentials are valid but no user profile exists.
class UserNotFoundAfterAuthException extends AppException {
  const UserNotFoundAfterAuthException()
      : super(
          'Authentication succeeded but no user profile exists. Please contact support.',
          errorCode: AppErrorCode.userNotFound,
        );
}

class UnexpectedAuthException extends AppException {
  const UnexpectedAuthException()
      : super(
          'An unexpected error occurred. Please try again.',
          errorCode: AppErrorCode.authUnexpected,
        );
}

// Additional exceptions for new methods
class IncorrectPasswordException extends AppException {
  const IncorrectPasswordException()
      : super(
          'Current password is incorrect.',
          errorCode: AppErrorCode.incorrectPassword,
        );
}

class UserNotAuthenticatedException extends AppException {
  const UserNotAuthenticatedException()
      : super(
          'You must be signed in to perform this action.',
          errorCode: AppErrorCode.unauthenticated,
        );
}

class AccountDeletionException extends AppException {
  const AccountDeletionException([String? message])
      : super(
          message ?? 'Failed to delete account. Please try again.',
          errorCode: AppErrorCode.accountDeletionFailed,
        );
}

class ProfileUpdateException extends AppException {
  const ProfileUpdateException([String? message])
      : super(
          message ?? 'Failed to update profile.',
          errorCode: AppErrorCode.profileUpdateFailed,
        );
}

class SessionExpiredException extends AppException {
  const SessionExpiredException()
      : super(
          'Your session has expired. Please sign in again.',
          errorCode: AppErrorCode.unauthenticated,
        );
}