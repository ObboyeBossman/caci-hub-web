enum UserRole {
  admin,
  pastor,
  secretary,
  volunteer,
  member,
  financeOfficer,
  welfareOfficer,
  cellLeader,
  elder,
  childrenWorker,
  mediaOfficer,
  districtOverseer,
  nationalAdmin;

  // TODO: re-enable when MFA enrollment flow is ready
  bool get requiresMfa => false;
  // bool get requiresMfa => [
  //   admin,
  //   pastor,
  //   nationalAdmin,
  //   districtOverseer,
  // ].contains(this);

  
  bool get hasDashboardAccess =>
      this == admin ||
      this == pastor ||
      this == nationalAdmin ||
      this == districtOverseer;

  bool get canManageMembers => this == admin || this == secretary;
  bool get canEditPastoralNotes => this == admin || this == pastor;
  bool get canViewAuditLog => this == admin;
  bool get canManageUsers => this == admin;

  // JSON serialization
  String toJson() => name;

  static UserRole fromJson(String value) {
    return UserRole.values.firstWhere(
      (e) => e.name == value,
      orElse: () => throw ArgumentError('Unknown UserRole: $value'),
    );
  }

  static UserRole? tryFromJson(String value) {
    try {
      return fromJson(value);
    } catch (_) {
      return null;
    }
  }
}
