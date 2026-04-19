import { memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import ChatListItem from './ChatListItem';
import type { Chat } from '../lib/types';

interface VirtualizedChatListProps {
  chats: Chat[];
  activeChat: string | null;
}

function VirtualizedChatList({ chats, activeChat }: VirtualizedChatListProps) {
  const Row = memo(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const chat = chats[index];
    if (!chat) return null;

    return (
      <div style={style}>
        <ChatListItem
          chat={chat}
          isActive={activeChat === chat.id}
        />
      </div>
    );
  });

  Row.displayName = 'ChatRow';

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          itemCount={chats.length}
          itemSize={72} // Height of each chat item
          width={width}
          overscanCount={5} // Render 5 extra items above/below viewport
        >
          {Row}
        </List>
      )}
    </AutoSizer>
  );
}

export default memo(VirtualizedChatList);
