"""
Claude AI chat API routes
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User, ChatMessage
from schemas import ChatMessageCreate, ChatResponse, TaskResponse
from auth.dependencies import get_current_user
from chat.service import ClaudeService

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
async def chat_with_assistant(
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
    try:
        claude_service = ClaudeService()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    # Get Claude's response and actions
    result = await claude_service.chat(
        user=current_user,
        message=message_data.message,
        db=db
    )

    # Execute any actions Claude suggested
    modified_tasks = []
    if result.get("actions"):
        modified_tasks = await claude_service.execute_actions(
            actions=result["actions"],
            user=current_user,
            db=db
        )

    # Save to chat history
    chat_entry = ChatMessage(
        user_id=current_user.id,
        message=message_data.message,
        response=result["response"]
    )
    db.add(chat_entry)
    db.commit()

    # Convert tasks to response format
    task_responses = [TaskResponse.from_orm(task) for task in modified_tasks]

    return ChatResponse(
        response=result["response"],
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
