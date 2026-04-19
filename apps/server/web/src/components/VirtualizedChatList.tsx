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
      {({ height, width }: any) => (
        <List
          height={height}
          itemCount={chats.length}
          itemSize={72}
          width={width}
          overscanCount={5}
        >
          {Row}
        </List>
      )}
    </AutoSizer>
  );
}

export default memo(VirtualizedChatList);
