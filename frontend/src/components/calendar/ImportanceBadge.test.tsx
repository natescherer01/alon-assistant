/**
 * ImportanceBadge Component Tests
 *
 * Tests for event importance indicator rendering,
 * different importance levels, and display variants
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ImportanceBadge from './ImportanceBadge';

describe('ImportanceBadge', () => {
  describe('Rendering', () => {
    it('should render high importance icon', () => {
      render(<ImportanceBadge importance="high" variant="icon" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('!');
    });

    it('should render low importance icon', () => {
      render(<ImportanceBadge importance="low" variant="icon" />);

      const badge = screen.getByLabelText('Low importance');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('↓');
    });

    it('should not render for normal importance', () => {
      const { container } = render(<ImportanceBadge importance="normal" variant="icon" />);

      expect(container).toBeEmptyDOMElement();
    });

    it('should not render if importance is undefined', () => {
      const { container } = render(<ImportanceBadge variant="icon" />);

      expect(container).toBeEmptyDOMElement();
    });

    it('should not render if importance is null', () => {
      const { container } = render(<ImportanceBadge importance={null as any} variant="icon" />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Icon Variant', () => {
    it('should render high importance with red color', () => {
      render(<ImportanceBadge importance="high" variant="icon" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveClass('text-red-500', 'font-bold');
    });

    it('should render low importance with gray color', () => {
      render(<ImportanceBadge importance="low" variant="icon" />);

      const badge = screen.getByLabelText('Low importance');
      expect(badge).toHaveClass('text-gray-400', 'font-bold');
    });

    it('should have correct symbol for high importance', () => {
      render(<ImportanceBadge importance="high" variant="icon" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveTextContent('!');
    });

    it('should have correct symbol for low importance', () => {
      render(<ImportanceBadge importance="low" variant="icon" />);

      const badge = screen.getByLabelText('Low importance');
      expect(badge).toHaveTextContent('↓');
    });

    it('should apply custom className', () => {
      render(<ImportanceBadge importance="high" variant="icon" className="custom-class" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveClass('custom-class');
    });

    it('should be a span element', () => {
      render(<ImportanceBadge importance="high" variant="icon" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge.tagName).toBe('SPAN');
    });
  });

  describe('Badge Variant', () => {
    it('should render high importance badge with text', () => {
      render(<ImportanceBadge importance="high" variant="badge" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveTextContent('High');
    });

    it('should render low importance badge with text', () => {
      render(<ImportanceBadge importance="low" variant="badge" />);

      const badge = screen.getByLabelText('Low importance');
      expect(badge).toHaveTextContent('Low');
    });

    it('should have correct styling for high importance badge', () => {
      render(<ImportanceBadge importance="high" variant="badge" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveClass('bg-red-50', 'text-red-500', 'font-bold');
    });

    it('should have correct styling for low importance badge', () => {
      render(<ImportanceBadge importance="low" variant="badge" />);

      const badge = screen.getByLabelText('Low importance');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-500', 'font-medium');
    });

    it('should have badge pill styling', () => {
      render(<ImportanceBadge importance="high" variant="badge" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveClass('inline-flex', 'items-center', 'px-1.5', 'py-0.5', 'rounded');
    });

    it('should have correct text size', () => {
      render(<ImportanceBadge importance="high" variant="badge" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveClass('text-xs');
    });

    it('should apply custom className to badge', () => {
      render(<ImportanceBadge importance="high" variant="badge" className="custom-badge-class" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveClass('custom-badge-class');
    });

    it('should not render badge for normal importance', () => {
      const { container } = render(<ImportanceBadge importance="normal" variant="badge" />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA label for high importance icon', () => {
      render(<ImportanceBadge importance="high" variant="icon" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveAttribute('aria-label', 'High importance');
    });

    it('should have proper ARIA label for low importance icon', () => {
      render(<ImportanceBadge importance="low" variant="icon" />);

      const badge = screen.getByLabelText('Low importance');
      expect(badge).toHaveAttribute('aria-label', 'Low importance');
    });

    it('should have proper ARIA label for high importance badge', () => {
      render(<ImportanceBadge importance="high" variant="badge" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveAttribute('aria-label', 'High importance');
    });

    it('should have proper ARIA label for low importance badge', () => {
      render(<ImportanceBadge importance="low" variant="badge" />);

      const badge = screen.getByLabelText('Low importance');
      expect(badge).toHaveAttribute('aria-label', 'Low importance');
    });

    it('should have title attribute for icon variant', () => {
      render(<ImportanceBadge importance="high" variant="icon" />);

      const badge = screen.getByTitle('High importance');
      expect(badge).toBeInTheDocument();
    });

    it('should have title attribute for low importance icon', () => {
      render(<ImportanceBadge importance="low" variant="icon" />);

      const badge = screen.getByTitle('Low importance');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Default Props', () => {
    it('should default to icon variant', () => {
      render(<ImportanceBadge importance="high" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveTextContent('!');
    });

    it('should handle missing variant prop', () => {
      render(<ImportanceBadge importance="low" />);

      const badge = screen.getByLabelText('Low importance');
      expect(badge).toHaveTextContent('↓');
    });

    it('should handle empty className', () => {
      render(<ImportanceBadge importance="high" variant="icon" className="" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid importance value gracefully', () => {
      const { container } = render(
        <ImportanceBadge importance={'invalid' as any} variant="icon" />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('should handle rapid prop changes', () => {
      const { rerender } = render(<ImportanceBadge importance="high" variant="icon" />);

      rerender(<ImportanceBadge importance="low" variant="icon" />);
      expect(screen.getByLabelText('Low importance')).toBeInTheDocument();

      rerender(<ImportanceBadge importance="normal" variant="icon" />);
      expect(screen.queryByLabelText(/importance/i)).not.toBeInTheDocument();

      rerender(<ImportanceBadge importance="high" variant="badge" />);
      expect(screen.getByLabelText('High importance')).toHaveTextContent('High');
    });

    it('should handle multiple instances with different importance levels', () => {
      render(
        <>
          <ImportanceBadge importance="high" variant="icon" />
          <ImportanceBadge importance="low" variant="icon" />
          <ImportanceBadge importance="normal" variant="icon" />
        </>
      );

      expect(screen.getByLabelText('High importance')).toBeInTheDocument();
      expect(screen.getByLabelText('Low importance')).toBeInTheDocument();
      expect(screen.queryByLabelText('Normal importance')).not.toBeInTheDocument();
    });

    it('should handle whitespace in className', () => {
      render(<ImportanceBadge importance="high" variant="icon" className="  extra-class  " />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveClass('extra-class');
    });
  });

  describe('Visual Consistency', () => {
    it('should maintain consistent size across importance levels', () => {
      const { rerender } = render(<ImportanceBadge importance="high" variant="icon" />);
      const highBadge = screen.getByLabelText('High importance');
      const highClasses = highBadge.className;

      rerender(<ImportanceBadge importance="low" variant="icon" />);
      const lowBadge = screen.getByLabelText('Low importance');
      const lowClasses = lowBadge.className;

      // Both should have font-bold
      expect(highClasses).toContain('font-bold');
      expect(lowClasses).toContain('font-bold');
    });

    it('should have consistent pill shape for badges', () => {
      const { rerender } = render(<ImportanceBadge importance="high" variant="badge" />);
      const highBadge = screen.getByLabelText('High importance');

      rerender(<ImportanceBadge importance="low" variant="badge" />);
      const lowBadge = screen.getByLabelText('Low importance');

      // Both should have same shape classes
      expect(highBadge).toHaveClass('rounded', 'px-1.5', 'py-0.5');
      expect(lowBadge).toHaveClass('rounded', 'px-1.5', 'py-0.5');
    });
  });

  describe('Integration Scenarios', () => {
    it('should work in event list context', () => {
      render(
        <div className="event-item">
          <span className="event-title">Important Meeting</span>
          <ImportanceBadge importance="high" variant="icon" />
        </div>
      );

      expect(screen.getByText('Important Meeting')).toBeInTheDocument();
      expect(screen.getByLabelText('High importance')).toBeInTheDocument();
    });

    it('should work alongside other metadata', () => {
      render(
        <div className="event-metadata">
          <span className="time">10:00 AM</span>
          <ImportanceBadge importance="high" variant="icon" />
          <span className="location">Conference Room A</span>
        </div>
      );

      expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      expect(screen.getByLabelText('High importance')).toBeInTheDocument();
      expect(screen.getByText('Conference Room A')).toBeInTheDocument();
    });

    it('should work with multiple variants in same view', () => {
      render(
        <>
          <ImportanceBadge importance="high" variant="icon" />
          <ImportanceBadge importance="high" variant="badge" />
        </>
      );

      const badges = screen.getAllByLabelText('High importance');
      expect(badges).toHaveLength(2);
      expect(badges[0]).toHaveTextContent('!');
      expect(badges[1]).toHaveTextContent('High');
    });
  });

  describe('Color Semantics', () => {
    it('should use red for high importance (urgent)', () => {
      render(<ImportanceBadge importance="high" variant="icon" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveClass('text-red-500');
    });

    it('should use gray for low importance (de-emphasized)', () => {
      render(<ImportanceBadge importance="low" variant="icon" />);

      const badge = screen.getByLabelText('Low importance');
      expect(badge).toHaveClass('text-gray-400');
    });

    it('should use light red background for high importance badge', () => {
      render(<ImportanceBadge importance="high" variant="badge" />);

      const badge = screen.getByLabelText('High importance');
      expect(badge).toHaveClass('bg-red-50', 'text-red-500');
    });

    it('should use light gray background for low importance badge', () => {
      render(<ImportanceBadge importance="low" variant="badge" />);

      const badge = screen.getByLabelText('Low importance');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-500');
    });
  });

  describe('Performance', () => {
    it('should handle rapid re-renders efficiently', () => {
      const { rerender } = render(<ImportanceBadge importance="high" variant="icon" />);

      for (let i = 0; i < 100; i++) {
        const importance = i % 3 === 0 ? 'high' : i % 3 === 1 ? 'low' : 'normal';
        rerender(<ImportanceBadge importance={importance as any} variant="icon" />);
      }

      // Should render final state
      expect(screen.getByLabelText('High importance')).toBeInTheDocument();
    });

    it('should not cause memory leaks with multiple instances', () => {
      const badges = Array.from({ length: 100 }, (_, i) => (
        <ImportanceBadge
          key={i}
          importance={i % 2 === 0 ? 'high' : 'low'}
          variant="icon"
        />
      ));

      const { unmount } = render(<>{badges}</>);

      // Should unmount cleanly
      unmount();
    });
  });
});
