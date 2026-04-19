import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  Skeleton,
  ChatListItemSkeleton,
  MessageBubbleSkeleton,
  CardSkeleton,
} from '../../components/Skeleton';

describe('Skeleton Components', () => {
  describe('Skeleton', () => {
    it('should render with default props', () => {
      const { container } = render(<Skeleton />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should apply variant classes', () => {
      const { container: textContainer } = render(<Skeleton variant="text" />);
      const { container: circularContainer } = render(
        <Skeleton variant="circular" />
      );

      expect(textContainer.firstChild).toHaveClass('rounded');
      expect(circularContainer.firstChild).toHaveClass('rounded-full');
    });

    it('should apply custom width and height', () => {
      const { container } = render(<Skeleton width={200} height={100} />);
      const element = container.firstChild as HTMLElement;

      expect(element.style.width).toBe('200px');
      expect(element.style.height).toBe('100px');
    });

    it('should apply animation classes', () => {
      const { container: waveContainer } = render(
        <Skeleton animation="wave" />
      );
      const { container: pulseContainer } = render(
        <Skeleton animation="pulse" />
      );

      expect(waveContainer.firstChild).toHaveClass('skeleton-shimmer');
      expect(pulseContainer.firstChild).toHaveClass('animate-pulse-soft');
    });

    it('should support no animation', () => {
      const { container } = render(<Skeleton animation="none" />);
      expect(container.firstChild).not.toHaveClass('skeleton-shimmer');
      expect(container.firstChild).not.toHaveClass('animate-pulse-soft');
    });
  });

  describe('ChatListItemSkeleton', () => {
    it('should render chat list item structure', () => {
      const { container } = render(<ChatListItemSkeleton />);
      const skeletons = container.querySelectorAll('[class*="bg-white/5"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('MessageBubbleSkeleton', () => {
    it('should render sent message skeleton', () => {
      const { container } = render(<MessageBubbleSkeleton sent={true} />);
      expect(container.firstChild).toHaveClass('justify-end');
    });

    it('should render received message skeleton', () => {
      const { container } = render(<MessageBubbleSkeleton sent={false} />);
      expect(container.firstChild).toHaveClass('justify-start');
    });
  });

  describe('CardSkeleton', () => {
    it('should render card structure', () => {
      const { container } = render(<CardSkeleton />);
      expect(container.querySelector('.glass-card')).toBeInTheDocument();
    });
  });
});
