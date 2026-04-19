import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Avatar from '../../components/Avatar';

describe('Avatar Component', () => {
  it('should render with image src', () => {
    const { container } = render(<Avatar src="https://example.com/avatar.jpg" name="John Doe" />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('should render initials when no src provided', () => {
    const { container } = render(<Avatar name="John Doe" />);
    expect(container.textContent).toContain('J');
  });

  it('should render verification badge when verified', () => {
    const { container } = render(
      <Avatar name="John Doe" isVerified={true} />
    );
    // Check for verification badge element
    const badge = container.querySelector('[class*="verified"]');
    expect(badge).toBeTruthy();
  });

  it('should apply correct size classes', () => {
    const { container: smallContainer } = render(
      <Avatar name="John" size="sm" />
    );
    const { container: largeContainer } = render(
      <Avatar name="John" size="lg" />
    );

    expect(smallContainer.firstChild).toHaveClass('w-8', 'h-8');
    expect(largeContainer.firstChild).toHaveClass('w-16', 'h-16');
  });

  it('should show online indicator when online', () => {
    const { container } = render(<Avatar name="John" online={true} />);
    const onlineIndicator = container.querySelector('[class*="bg-green"]');
    expect(onlineIndicator).toBeTruthy();
  });

  it('should handle custom className', () => {
    const { container } = render(
      <Avatar name="John" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render custom verified badge URL', () => {
    const { container } = render(
      <Avatar
        name="John"
        isVerified={true}
        verifiedBadgeUrl="https://example.com/badge.png"
        verifiedBadgeType="custom"
      />
    );
    const badgeImg = container.querySelector('img[src*="badge.png"]');
    expect(badgeImg).toBeTruthy();
  });
});
