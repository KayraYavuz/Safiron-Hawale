from app.models.user import User, UserRole


def get_company_id(current_user: User):
    """Returns company_id for filtering. None means super_admin (sees all)."""
    if current_user.role == UserRole.super_admin:
        return None  # sees everything
    return current_user.company_id


def apply_company_filter(query, model, current_user: User):
    """Apply company_id filter to a SQLAlchemy query."""
    company_id = get_company_id(current_user)
    if company_id is not None:
        query = query.filter(model.company_id == company_id)
    return query
