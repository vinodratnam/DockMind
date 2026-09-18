"""
Chat and Message CRUD service.

Manages conversation sessions and their individual messages.
RAG generation is handled by rag_service.py — this module is pure CRUD.
"""
import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.models.chat import Chat
from app.models.message import Message, MessageRole
from app.schemas.chat import ChatCreate, ChatUpdate
from app.schemas.message import MessageCreate, MessageRead, SourceRead


async def create_chat(db: AsyncSession, user_id: int, payload: ChatCreate) -> Chat:
    """Create a new chat session for a user."""
    chat = Chat(user_id=user_id, title=payload.title)
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


async def get_chat(db: AsyncSession, chat_id: int, user_id: int) -> Chat | None:
    """Return a chat with its messages if it belongs to the requesting user."""
    result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.messages))
        .where(Chat.id == chat_id, Chat.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def list_user_chats(db: AsyncSession, user_id: int) -> list[Chat]:
    """Return all chats for a user, most-recently-updated first."""
    result = await db.execute(
        select(Chat)
        .where(Chat.user_id == user_id)
        .order_by(Chat.updated_at.desc())
    )
    return list(result.scalars().all())


async def update_chat(db: AsyncSession, chat: Chat, payload: ChatUpdate) -> Chat:
    """Update mutable chat fields (e.g. title rename)."""
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(chat, field, value)
    await db.commit()
    await db.refresh(chat)
    return chat


async def delete_chat(db: AsyncSession, chat_id: int, user_id: int) -> bool:
    """Delete a chat and all its messages (cascade). Returns True if deleted."""
    result = await db.execute(
        delete(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
    )
    await db.commit()
    return result.rowcount > 0


async def add_message(db: AsyncSession, chat_id: int, payload: MessageCreate) -> Message:
    """
    Append a raw message to an existing chat (no RAG generation).
    For RAG messages use rag_service._persist_conversation instead.
    """
    message = Message(
        chat_id=chat_id,
        role=payload.role,
        content=payload.content,
        sources_json=None,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def list_messages(db: AsyncSession, chat_id: int) -> list[Message]:
    """Return all messages for a chat in chronological order."""
    result = await db.execute(
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())


async def list_messages_with_sources(
    db: AsyncSession, chat_id: int
) -> list[MessageRead]:
    """
    Return all messages with parsed sources for the API response.
    Parses sources_json into a list of SourceRead objects.
    """
    messages = await list_messages(db, chat_id)
    result = []
    for msg in messages:
        sources: list[SourceRead] = []
        if msg.sources_json:
            try:
                raw = json.loads(msg.sources_json)
                sources = [SourceRead(**s) for s in raw]
            except Exception:
                pass

        result.append(
            MessageRead(
                id=msg.id,
                chat_id=msg.chat_id,
                role=msg.role,
                content=msg.content,
                sources=sources,
                created_at=msg.created_at,
            )
        )
    return result
