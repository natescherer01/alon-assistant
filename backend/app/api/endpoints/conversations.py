"""
Conversation API Endpoints

Implements all security features from Best Practices review:
- Secure ETags (Critical Issue #1)
- Cache ownership validation (Critical Issue #3)
- Optimistic locking (Critical Issue #5)
- Proper pagination (High Priority Issue #10)
- N+1 elimination (High Priority Issue #8)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header, Response, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.deps import get_db, get_current_user_id, validate_cache_ownership, require_etag_match
from app.crud.conversation import conversation_crud, message_crud
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    PaginatedConversationsResponse,
    PaginatedMessagesResponse,
    PaginationParams,
)
from app.utils.cache import generate_secure_etag, should_return_304, cache_metrics
from app.core.config import settings

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.get("/", response_model=PaginatedConversationsResponse)
@limiter.limit("1000/hour")  # Read endpoints: high limit
async def list_conversations(
    request: Request,  # Required for rate limiting
    pagination: PaginationParams = Depends(),
    archived: bool = False,
    if_none_match: Optional[str] = Header(None),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List conversations with cursor-based pagination"""
    conversations, next_cursor, total_count = conversation_crud.get_conversations_optimized(
        db=db,
        user_id=current_user_id,
        cursor=pagination.cursor,
        limit=pagination.limit,
        archived=archived,
    )

    conversation_responses = []
    for conv in conversations:
        conv_dict = {
            "id": conv.id,
            "user_id": conv.user_id,
            "title": conv.title,
            "archived": conv.archived,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "message_count": len(conv.messages) if conv.messages else 0,
        }
        etag = generate_secure_etag(conv_dict, current_user_id, settings.SECRET_KEY)
        conv_dict["etag"] = etag
        conversation_responses.append(ConversationResponse(**conv_dict))

    result = PaginatedConversationsResponse(
        items=conversation_responses,
        next_cursor=next_cursor,
        total_count=total_count if not pagination.cursor else None,
        has_more=next_cursor is not None,
    )

    list_etag = generate_secure_etag(result.dict(), current_user_id, settings.SECRET_KEY)

    if should_return_304(if_none_match, list_etag):
        cache_metrics.record_hit()
        return JSONResponse(content=None, status_code=304, headers={"ETag": list_etag})

    cache_metrics.record_miss()
    return JSONResponse(
        content=result.dict(),
        headers={
            "ETag": list_etag,
            "Cache-Control": f"private, max-age={settings.CACHE_MAX_AGE}",
        }
    )


@router.get("/{conversation_id}", response_model=ConversationResponse)
@limiter.limit("1000/hour")  # Read endpoints: high limit
async def get_conversation(
    request: Request,  # Required for rate limiting
    conversation_id: str,
    if_none_match: Optional[str] = Header(None),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get single conversation"""
    conversation = conversation_crud.get_conversation(db, conversation_id, current_user_id)

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    validate_cache_ownership(conversation.user_id, current_user_id)

    conv_dict = {
        "id": conversation.id,
        "user_id": conversation.user_id,
        "title": conversation.title,
        "archived": conversation.archived,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "message_count": len(conversation.messages) if conversation.messages else 0,
    }

    etag = generate_secure_etag(conv_dict, current_user_id, settings.SECRET_KEY)

    if should_return_304(if_none_match, etag):
        cache_metrics.record_hit()
        return JSONResponse(content=None, status_code=304, headers={"ETag": etag})

    cache_metrics.record_miss()
    conv_dict["etag"] = etag

    return JSONResponse(
        content=ConversationResponse(**conv_dict).dict(),
        headers={
            "ETag": etag,
            "Cache-Control": f"private, max-age={settings.CACHE_MAX_AGE}",
        }
    )


@router.post("/", response_model=ConversationResponse, status_code=201)
@limiter.limit("100/hour")  # Conversation creation: moderate limit
async def create_conversation(
    request: Request,  # Required for rate limiting
    conversation: ConversationCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create new conversation"""
    new_conversation = conversation_crud.create_conversation(db, conversation, current_user_id)

    conv_dict = {
        "id": new_conversation.id,
        "user_id": new_conversation.user_id,
        "title": new_conversation.title,
        "archived": new_conversation.archived,
        "created_at": new_conversation.created_at,
        "updated_at": new_conversation.updated_at,
        "message_count": 0,
    }

    etag = generate_secure_etag(conv_dict, current_user_id, settings.SECRET_KEY)
    conv_dict["etag"] = etag

    return JSONResponse(
        content=ConversationResponse(**conv_dict).dict(),
        status_code=201,
        headers={"ETag": etag}
    )


@router.patch("/{conversation_id}", response_model=ConversationResponse)
@limiter.limit("200/hour")  # Update operations: moderate limit
async def update_conversation(
    request: Request,  # Required for rate limiting
    conversation_id: str,
    updates: ConversationUpdate,
    if_match: Optional[str] = Header(None),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update conversation with optimistic locking"""
    conversation = conversation_crud.get_conversation(db, conversation_id, current_user_id)

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    validate_cache_ownership(conversation.user_id, current_user_id)

    conv_dict = {
        "id": conversation.id,
        "user_id": conversation.user_id,
        "title": conversation.title,
        "archived": conversation.archived,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "message_count": len(conversation.messages) if conversation.messages else 0,
    }

    current_etag = generate_secure_etag(conv_dict, current_user_id, settings.SECRET_KEY)
    require_etag_match(if_match, current_etag)

    updated_conversation = conversation_crud.update_conversation(
        db, conversation_id, current_user_id, updates
    )

    if not updated_conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    updated_dict = {
        "id": updated_conversation.id,
        "user_id": updated_conversation.user_id,
        "title": updated_conversation.title,
        "archived": updated_conversation.archived,
        "created_at": updated_conversation.created_at,
        "updated_at": updated_conversation.updated_at,
        "message_count": len(updated_conversation.messages) if updated_conversation.messages else 0,
    }

    new_etag = generate_secure_etag(updated_dict, current_user_id, settings.SECRET_KEY)
    updated_dict["etag"] = new_etag

    return JSONResponse(
        content=ConversationResponse(**updated_dict).dict(),
        headers={"ETag": new_etag}
    )


@router.delete("/{conversation_id}", status_code=204)
@limiter.limit("100/hour")  # Delete operations: moderate limit
async def delete_conversation(
    request: Request,  # Required for rate limiting
    conversation_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete conversation"""
    conversation = conversation_crud.get_conversation(db, conversation_id, current_user_id)

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    validate_cache_ownership(conversation.user_id, current_user_id)

    success = conversation_crud.delete_conversation(db, conversation_id, current_user_id)

    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return Response(status_code=204)


@router.get("/{conversation_id}/messages", response_model=PaginatedMessagesResponse)
@limiter.limit("1000/hour")  # Read endpoints: high limit
async def list_messages(
    request: Request,  # Required for rate limiting
    conversation_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List messages in conversation"""
    messages = message_crud.get_messages(db, conversation_id, current_user_id, skip, limit)

    message_responses = [
        MessageResponse(
            id=msg.id,
            conversation_id=msg.conversation_id,
            content=msg.content,
            role=msg.role,
            created_at=msg.created_at
        )
        for msg in messages
    ]

    return PaginatedMessagesResponse(
        items=message_responses,
        next_cursor=None,
        total_count=len(message_responses),
        has_more=False,
    )


@router.post("/{conversation_id}/messages", response_model=MessageResponse, status_code=201)
@limiter.limit("500/hour")  # Message creation: high limit for chat
async def create_message(
    request: Request,  # Required for rate limiting
    conversation_id: str,
    message: MessageCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create new message"""
    new_message = message_crud.create_message(
        db, conversation_id, current_user_id, message.content, message.role
    )

    if not new_message:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return MessageResponse(
        id=new_message.id,
        conversation_id=new_message.conversation_id,
        content=new_message.content,
        role=new_message.role,
        created_at=new_message.created_at
    )
