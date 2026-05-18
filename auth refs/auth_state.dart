import 'package:caci_hub/core/errors/app_error_code.dart';
import 'package:caci_hub/modules/auth/domain/entities/auth_user.dart';

sealed class AuthState {
  const AuthState();
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthPasswordReset extends AuthState {
  const AuthPasswordReset();
}

class AuthPasswordResetEmailSent extends AuthState {
  final String email;
  const AuthPasswordResetEmailSent(this.email);
}

class AuthAuthenticated extends AuthState {
  final AuthUser user;
  const AuthAuthenticated(this.user);
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();   // no error message
}

class AuthOtpSent extends AuthState {
  final String phone;
  const AuthOtpSent(this.phone);
}

class AuthMfaRequired extends AuthState {
  final AuthUser user;
  const AuthMfaRequired(this.user);
}

class AuthError extends AuthState {
  final String message;
  final AppErrorCode errorCode;

  const AuthError(
    this.message, {
    this.errorCode = AppErrorCode.unknown,
  });
}