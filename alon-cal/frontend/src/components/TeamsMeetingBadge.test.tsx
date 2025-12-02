/**
 * TeamsMeetingBadge Component Tests
 *
 * Tests for Microsoft Teams meeting badge rendering,
 * link handling, and various display variants
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamsMeetingBadge from './TeamsMeetingBadge';

describe('TeamsMeetingBadge', () => {
  const teamsMeetingUrl = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123';

  describe('Rendering', () => {
    it('should render icon variant by default', () => {
      const { container } = render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} />);

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-4', 'h-4'); // md size by default
    });

    it('should render button variant with text', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />);

      const button = screen.getByRole('link', { name: /join teams meeting/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Join Teams Meeting');
    });

    it('should not render if no meeting URL provided', () => {
      const { container } = render(<TeamsMeetingBadge />);

      expect(container).toBeEmptyDOMElement();
    });

    it('should not render if meeting URL is empty string', () => {
      const { container } = render(<TeamsMeetingBadge teamsMeetingUrl="" />);

      expect(container).toBeEmptyDOMElement();
    });

    it('should not render if meeting URL is undefined', () => {
      const { container } = render(<TeamsMeetingBadge teamsMeetingUrl={undefined} />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Size Variants', () => {
    it('should render small icon', () => {
      const { container } = render(
        <TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} size="sm" variant="icon" />
      );

      const icon = container.querySelector('svg');
      expect(icon).toHaveClass('w-3', 'h-3');
    });

    it('should render medium icon (default)', () => {
      const { container } = render(
        <TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} size="md" variant="icon" />
      );

      const icon = container.querySelector('svg');
      expect(icon).toHaveClass('w-4', 'h-4');
    });

    it('should render large icon', () => {
      const { container } = render(
        <TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} size="lg" variant="icon" />
      );

      const icon = container.querySelector('svg');
      expect(icon).toHaveClass('w-5', 'h-5');
    });

    it('should apply correct button size classes', () => {
      render(
        <TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} size="sm" variant="button" />
      );

      const button = screen.getByRole('link');
      expect(button).toHaveClass('px-2', 'py-1', 'text-xs');
    });

    it('should apply medium button size', () => {
      render(
        <TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} size="md" variant="button" />
      );

      const button = screen.getByRole('link');
      expect(button).toHaveClass('px-3', 'py-2', 'text-sm');
    });

    it('should apply large button size', () => {
      render(
        <TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} size="lg" variant="button" />
      );

      const button = screen.getByRole('link');
      expect(button).toHaveClass('px-4', 'py-2.5', 'text-base');
    });
  });

  describe('Icon Variant', () => {
    it('should have correct ARIA label', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="icon" />);

      const icon = screen.getByLabelText('Teams Meeting');
      expect(icon).toBeInTheDocument();
    });

    it('should have title attribute', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="icon" />);

      const icon = screen.getByTitle('Teams Meeting');
      expect(icon).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(
        <TeamsMeetingBadge
          teamsMeetingUrl={teamsMeetingUrl}
          variant="icon"
          className="custom-class"
        />
      );

      const icon = screen.getByLabelText('Teams Meeting');
      expect(icon).toHaveClass('custom-class');
    });

    it('should render Teams icon SVG with correct path', () => {
      const { container } = render(
        <TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="icon" />
      );

      const svg = container.querySelector('svg');
      const path = svg?.querySelector('path');
      expect(path).toBeInTheDocument();
      expect(path?.getAttribute('d')).toContain('19.75');
    });
  });

  describe('Button Variant', () => {
    it('should render as anchor link', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />);

      const link = screen.getByRole('link', { name: /join teams meeting/i });
      expect(link.tagName).toBe('A');
    });

    it('should have correct href', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', teamsMeetingUrl);
    });

    it('should open in new tab', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should have correct styling classes', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('bg-blue-600', 'text-white', 'rounded-lg', 'hover:bg-blue-700');
    });

    it('should stop event propagation on click', async () => {
      const user = userEvent.setup();
      const parentClickHandler = vi.fn();

      const { container } = render(
        <div onClick={parentClickHandler}>
          <TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />
        </div>
      );

      const link = screen.getByRole('link');
      await user.click(link);

      // Parent click should not be called due to stopPropagation
      expect(parentClickHandler).not.toHaveBeenCalled();
    });

    it('should contain Teams icon and text', () => {
      const { container } = render(
        <TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />
      );

      const link = screen.getByRole('link');
      const svg = link.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(link).toHaveTextContent('Join Teams Meeting');
    });

    it('should apply custom className to button', () => {
      render(
        <TeamsMeetingBadge
          teamsMeetingUrl={teamsMeetingUrl}
          variant="button"
          className="custom-button-class"
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveClass('custom-button-class');
    });
  });

  describe('URL Handling', () => {
    it('should handle standard Teams meeting URL', () => {
      const url = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz';
      render(<TeamsMeetingBadge teamsMeetingUrl={url} variant="button" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', url);
    });

    it('should handle Teams URL with query parameters', () => {
      const url = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz?tid=abc&oid=123';
      render(<TeamsMeetingBadge teamsMeetingUrl={url} variant="button" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', url);
    });

    it('should handle Teams URL with long meeting ID', () => {
      const url = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_' + 'a'.repeat(100);
      render(<TeamsMeetingBadge teamsMeetingUrl={url} variant="button" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', url);
    });

    it('should handle Teams channel meeting URL', () => {
      const url =
        'https://teams.microsoft.com/l/channel/19%3achannel_id%40thread.tacv2/General?groupId=group123';
      render(<TeamsMeetingBadge teamsMeetingUrl={url} variant="button" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', url);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for icon variant', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="icon" />);

      const icon = screen.getByLabelText('Teams Meeting');
      expect(icon).toHaveAttribute('aria-label', 'Teams Meeting');
    });

    it('should be keyboard accessible for button variant', async () => {
      const user = userEvent.setup();
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />);

      const link = screen.getByRole('link');

      // Should be focusable
      await user.tab();
      expect(link).toHaveFocus();
    });

    it('should have proper rel attribute for security', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should have descriptive link text', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />);

      const link = screen.getByRole('link', { name: /join teams meeting/i });
      expect(link).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null URL gracefully', () => {
      const { container } = render(<TeamsMeetingBadge teamsMeetingUrl={null as any} />);

      expect(container).toBeEmptyDOMElement();
    });

    it('should handle whitespace-only URL', () => {
      const { container } = render(<TeamsMeetingBadge teamsMeetingUrl="   " />);

      // Should render because string is truthy, even if whitespace
      expect(container).not.toBeEmptyDOMElement();
    });

    it('should handle multiple instances with different URLs', () => {
      const { container } = render(
        <>
          <TeamsMeetingBadge
            teamsMeetingUrl="https://teams.microsoft.com/l/meetup-join/meeting1"
            variant="button"
          />
          <TeamsMeetingBadge
            teamsMeetingUrl="https://teams.microsoft.com/l/meetup-join/meeting2"
            variant="button"
          />
        </>
      );

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute('href', 'https://teams.microsoft.com/l/meetup-join/meeting1');
      expect(links[1]).toHaveAttribute('href', 'https://teams.microsoft.com/l/meetup-join/meeting2');
    });

    it('should handle rapid re-renders', () => {
      const { rerender } = render(
        <TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="icon" />
      );

      for (let i = 0; i < 10; i++) {
        rerender(
          <TeamsMeetingBadge
            teamsMeetingUrl={`${teamsMeetingUrl}${i}`}
            variant={i % 2 === 0 ? 'icon' : 'button'}
          />
        );
      }

      // Should render final state without errors
      expect(screen.getByRole('link')).toBeInTheDocument();
    });
  });

  describe('Visual Styling', () => {
    it('should have correct color scheme for button', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />);

      const button = screen.getByRole('link');
      expect(button).toHaveClass('bg-blue-600');
      expect(button).toHaveClass('text-white');
    });

    it('should have hover effect on button', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />);

      const button = screen.getByRole('link');
      expect(button).toHaveClass('hover:bg-blue-700');
    });

    it('should have transition effect', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />);

      const button = screen.getByRole('link');
      expect(button).toHaveClass('transition-colors');
    });

    it('should have proper spacing in button', () => {
      render(<TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="button" />);

      const button = screen.getByRole('link');
      expect(button).toHaveClass('gap-2'); // Gap between icon and text
    });
  });

  describe('Integration', () => {
    it('should work in event card context', () => {
      const { container } = render(
        <div className="event-card">
          <h3>Team Meeting</h3>
          <TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="icon" />
        </div>
      );

      expect(screen.getByLabelText('Teams Meeting')).toBeInTheDocument();
      expect(screen.getByText('Team Meeting')).toBeInTheDocument();
    });

    it('should work alongside other badges', () => {
      render(
        <div>
          <TeamsMeetingBadge teamsMeetingUrl={teamsMeetingUrl} variant="icon" size="sm" />
          <span className="importance-badge">High</span>
          <span className="category-badge">Work</span>
        </div>
      );

      expect(screen.getByLabelText('Teams Meeting')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();
    });
  });
});
