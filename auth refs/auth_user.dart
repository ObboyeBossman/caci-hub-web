import 'package:caci_hub/modules/auth/domain/enums/user_role.dart';

class AuthUser {
  final String id;
  final String? phone;
  final String? email;
  final String fullName;
  final UserRole role;
  final String? assemblyId;
  final bool isMfaVerified;
  final bool isMfaEnrolled; // ← true once a TOTP factor exists in Supabase

  const AuthUser({
    required this.id,
    this.phone,
    this.email,
    required this.fullName,
    required this.role,
    this.assemblyId,
    this.isMfaVerified = false,
    this.isMfaEnrolled = false,
  });

  AuthUser copyWith({
    String? fullName,
    UserRole? role,
    String? assemblyId,
    bool? isMfaVerified,
    bool? isMfaEnrolled,
  }) {
    return AuthUser(
      id: id,
      phone: phone,
      email: email,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
      assemblyId: assemblyId ?? this.assemblyId,
      isMfaVerified: isMfaVerified ?? this.isMfaVerified,
      isMfaEnrolled: isMfaEnrolled ?? this.isMfaEnrolled,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'phone': phone,
        'email': email,
        'fullName': fullName,
        'role': role.toJson(),
        'assemblyId': assemblyId,
        'isMfaVerified': isMfaVerified,
        'isMfaEnrolled': isMfaEnrolled,
      };

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      fullName: json['fullName'] as String,
      role: UserRole.fromJson(json['role'] as String),
      assemblyId: json['assemblyId'] as String?,
      isMfaVerified: json['isMfaVerified'] as bool? ?? false,
      isMfaEnrolled: json['isMfaEnrolled'] as bool? ?? false,
    );
  }
}
