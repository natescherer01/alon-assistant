"""
Claude AI chat API routes
"""
from typing import List
import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models import User, ChatMessage
from schemas import ChatMessageCreate, ChatResponse, TaskResponse
from auth.dependencies import get_current_user
from chat.service import ClaudeService
from rate_limit import limiter
from logger import get_logger

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = get_logger(__name__)


@router.post("", response_model=ChatResponse)
# TODO: Re-enable after fixing rate limiting
# @limiter.limit("20/minute")  # Max 20 chat messages per minute to prevent API cost explosion
async def chat_with_assistant(
    request: Request,
    message_data: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a message to the Claude AI assistant

    The assistant can:
    - Answer questions about tasks
    - Suggest what to work on next
    - Add new tasks
    - Update task status
    - Provide productivity advice

    Returns:
        Claude's response and any task updates that were made
    """
    logger.info(f"Chat message from user {current_user.email}: {message_data.message[:50]}...")

    try:
        # Initialize Claude service with system API key
        claude_service = ClaudeService()
    except ValueError as e:
        logger.error(f"Failed to initialize Claude service: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service not configured. Please contact administrator."
        )

    # Get Claude's response and actions
    try:
        result = await claude_service.chat(
            user=current_user,
            message=message_data.message,
            db=db
        )
    except Exception as e:
        logger.error(f"Chat error for user {current_user.email}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process chat message. Please try again."
        )

    # Execute any actions Claude suggested
    modified_tasks = []
    if result.get("actions"):
        modified_tasks = await claude_service.execute_actions(
            actions=result["actions"],
            user=current_user,
            db=db
        )

    # Clean response: Remove ACTION lines and format nicely
    import re
    cleaned_response = result["response"]
    # Remove lines starting with "ACTION:" (case-insensitive)
    cleaned_response = re.sub(r'(?m)^ACTION:.*$\n?', '', cleaned_response)
    # Remove empty lines that might be left over
    cleaned_response = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_response)
    cleaned_response = cleaned_response.strip()

    # Save to chat history
    chat_entry = ChatMessage(
        user_id=current_user.id,
        message=message_data.message,
        response=cleaned_response
    )
    db.add(chat_entry)

    # Auto-cleanup: Delete messages older than 30 days to prevent memory bloat
    from datetime import datetime, timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id,
        ChatMessage.created_at < thirty_days_ago
    ).delete()

    # Auto-cleanup: Keep only most recent 500 messages per user
    user_message_count = db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id
    ).count()

    if user_message_count > 500:
        # Get IDs of oldest messages to delete
        messages_to_delete = db.query(ChatMessage.id).filter(
            ChatMessage.user_id == current_user.id
        ).order_by(ChatMessage.created_at.asc()).limit(user_message_count - 500).all()

        message_ids = [msg.id for msg in messages_to_delete]
        if message_ids:
            db.query(ChatMessage).filter(ChatMessage.id.in_(message_ids)).delete(synchronize_session=False)

    db.commit()

    # Convert tasks to response format
    task_responses = [TaskResponse.from_orm(task) for task in modified_tasks]

    return ChatResponse(
        response=cleaned_response,
        task_updates=task_responses,
        suggested_actions=[]
    )


@router.get("/history", response_model=List[dict])
async def get_chat_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get chat history for the current user

    Args:
        limit: Maximum number of messages to return (default: 50)
    """
    messages = db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id
    ).order_by(ChatMessage.created_at.desc()).limit(limit).all()

    # Reverse to show oldest first
    messages.reverse()

    return [
        {
            "id": msg.id,
            "message": msg.message,
            "response": msg.response,
            "created_at": msg.created_at
        }
        for msg in messages
    ]


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear all chat history for the current user"""
    db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id
    ).delete()
    db.commit()

    return None


@router.post("/stream")
async def chat_with_assistant_stream(
    request: Request,
    message_data: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stream a response from the Claude AI assistant using Server-Sent Events (SSE)

    Returns a stream of JSON events:
    - {"type": "token", "content": "..."} - A token of the response
    - {"type": "done", "task_updates": [...]} - Stream complete with any task updates
    - {"type": "error", "message": "..."} - An error occurred
    """
    logger.info(f"Streaming chat message from user {current_user.email}: {message_data.message[:50]}...")

    try:
        claude_service = ClaudeService()
    except ValueError as e:
        logger.error(f"Failed to initialize Claude service: {e}")
        async def error_generator():
            yield f"data: {json.dumps({'type': 'error', 'message': 'AI service not configured'})}\n\n"
        return StreamingResponse(error_generator(), media_type="text/event-stream")

    async def generate():
        full_response = ""
        try:
            # Stream response from Claude
            async for token in claude_service.chat_stream(
                user=current_user,
                message=message_data.message,
                db=db
            ):
                full_response += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                await asyncio.sleep(0)  # Allow other tasks to run

            # Parse actions from full response
            actions = claude_service._parse_actions(full_response)

            # Execute any actions Claude suggested
            modified_tasks = []
            if actions:
                modified_tasks = await claude_service.execute_actions(
                    actions=actions,
                    user=current_user,
                    db=db
                )

            # Clean response for storage
            import re
            cleaned_response = full_response
            cleaned_response = re.sub(r'(?m)^ACTION:.*$\n?', '', cleaned_response)
            cleaned_response = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_response)
            cleaned_response = cleaned_response.strip()

            # Save to chat history
            chat_entry = ChatMessage(
                user_id=current_user.id,
                message=message_data.message,
                response=cleaned_response
            )
            db.add(chat_entry)

            # Auto-cleanup old messages
            from datetime import datetime, timedelta
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            db.query(ChatMessage).filter(
                ChatMessage.user_id == current_user.id,
                ChatMessage.created_at < thirty_days_ago
            ).delete()

            db.commit()

            # Convert tasks to response format
            task_responses = [TaskResponse.from_orm(task).dict() for task in modified_tasks]

            # Send done event with task updates
            yield f"data: {json.dumps({'type': 'done', 'task_updates': task_responses})}\n\n"

        except Exception as e:
            logger.error(f"Streaming error for user {current_user.email}: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Transfer-Encoding": "chunked",
            "Content-Encoding": "identity",  # Disable compression for streaming
        }
    )
