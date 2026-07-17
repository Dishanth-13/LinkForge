import uuid
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, model_validator

class ActorRead(BaseModel):
    id: uuid.UUID
    email: str
    role: str

    model_config = ConfigDict(from_attributes=True)

class AuditEventResponse(BaseModel):
    id: uuid.UUID
    timestamp: datetime
    event_type: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    actor: Optional[ActorRead] = None
    metadata_json: Optional[dict[str, Any]] = None
    human_readable_message: str = ""

    @model_validator(mode="before")
    @classmethod
    def compute_message(cls, data: Any) -> Any:
        # Resolve values from dict or object representation
        event_type = getattr(data, "event_type", None)
        if event_type is None and isinstance(data, dict):
            event_type = data.get("event_type")

        metadata = getattr(data, "metadata_json", None)
        if metadata is None and isinstance(data, dict):
            metadata = data.get("metadata_json")
        if metadata is None:
            metadata = {}

        # Resolve actor email
        actor_email = None
        actor = getattr(data, "actor", None)
        if actor is None and isinstance(data, dict):
            actor = data.get("actor")
        
        if actor:
            actor_email = getattr(actor, "email", None)
            if actor_email is None and isinstance(actor, dict):
                actor_email = actor.get("email")
        
        if not actor_email:
            user = getattr(data, "actor_user", None)
            if user:
                actor_email = getattr(user, "email", None)

        msg = generate_message(event_type or "", actor_email or "System", metadata)

        if isinstance(data, dict):
            data["human_readable_message"] = msg
        else:
            # Set virtual attribute on object dynamically
            object.__setattr__(data, "human_readable_message", msg)

        return data

    model_config = ConfigDict(from_attributes=True)

class AuditEventsListResponse(BaseModel):
    events: list[AuditEventResponse]
    total_count: int

def generate_message(event_type: str, actor_email: str, meta: dict[str, Any]) -> str:
    actor = actor_email or "System"
    
    # Links
    if event_type == "link.created":
        alias = meta.get("custom_alias")
        name = f"\"{alias}\"" if alias else f"code \"{meta.get('short_code', '')}\""
        return f"{actor} created link {name}"
    elif event_type == "link.updated":
        alias = meta.get("custom_alias")
        name = f"\"{alias}\"" if alias else f"code \"{meta.get('short_code', '')}\""
        return f"{actor} updated link {name}"
    elif event_type == "link.activated":
        alias = meta.get("custom_alias")
        name = f"\"{alias}\"" if alias else f"code \"{meta.get('short_code', '')}\""
        return f"{actor} activated link {name}"
    elif event_type == "link.deactivated":
        alias = meta.get("custom_alias")
        name = f"\"{alias}\"" if alias else f"code \"{meta.get('short_code', '')}\""
        return f"{actor} deactivated link {name}"
    elif event_type == "link.deleted":
        alias = meta.get("custom_alias")
        name = f"\"{alias}\"" if alias else f"code \"{meta.get('short_code', '')}\""
        return f"{actor} deleted link {name}"
        
    # API Keys
    elif event_type == "api_key.created":
        return f"{actor} generated API key \"{meta.get('key_name', '')}\""
    elif event_type == "api_key.revoked":
        return f"{actor} revoked API key \"{meta.get('key_name', '')}\""
    elif event_type == "api_key.regenerated":
        return f"{actor} regenerated API key \"{meta.get('key_name', '')}\""
        
    # Sessions
    elif event_type == "user.login":
        return f"{actor} logged in"
    elif event_type == "user.logout":
        return f"{actor} logged out"
        
    # Users
    elif event_type == "user.created":
        return f"{actor} created user \"{meta.get('user_email', '')}\""
    elif event_type == "user.deleted":
        return f"{actor} deleted user \"{meta.get('user_email', '')}\""
        
    # Organizations & Registration
    elif event_type == "organization.created":
        return f"Organization \"{meta.get('org_name', '')}\" was created"
    elif event_type == "user.registered":
        return f"{actor} registered account"
        
    return f"{actor} performed {event_type}"
