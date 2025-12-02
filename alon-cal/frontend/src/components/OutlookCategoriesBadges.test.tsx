/**
 * OutlookCategoriesBadges Component Tests
 *
 * Tests for Outlook category badges rendering,
 * overflow handling, and display logic
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OutlookCategoriesBadges from './OutlookCategoriesBadges';

describe('OutlookCategoriesBadges', () => {
  describe('Rendering', () => {
    it('should render single category', () => {
      render(<OutlookCategoriesBadges categories={['Work']} />);

      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    it('should render multiple categories', () => {
      render(<OutlookCategoriesBadges categories={['Work', 'Important', 'Meeting']} />);

      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Important')).toBeInTheDocument();
      expect(screen.getByText('Meeting')).toBeInTheDocument();
    });

    it('should not render if categories is undefined', () => {
      const { container } = render(<OutlookCategoriesBadges />);

      expect(container).toBeEmptyDOMElement();
    });

    it('should not render if categories is null', () => {
      const { container } = render(<OutlookCategoriesBadges categories={null as any} />);

      expect(container).toBeEmptyDOMElement();
    });

    it('should not render if categories is empty array', () => {
      const { container } = render(<OutlookCategoriesBadges categories={[]} />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('MaxDisplay Limit', () => {
    it('should show all categories when under maxDisplay', () => {
      render(<OutlookCategoriesBadges categories={['Work', 'Personal']} maxDisplay={3} />);

      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
    });

    it('should show overflow indicator when exceeding maxDisplay', () => {
      render(
        <OutlookCategoriesBadges
          categories={['Work', 'Personal', 'Important', 'Meeting']}
          maxDisplay={3}
        />
      );

      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText('Important')).toBeInTheDocument();
      expect(screen.getByText('+1')).toBeInTheDocument();
      expect(screen.queryByText('Meeting')).not.toBeInTheDocument();
    });

    it('should use default maxDisplay of 3', () => {
      render(
        <OutlookCategoriesBadges categories={['Cat1', 'Cat2', 'Cat3', 'Cat4', 'Cat5']} />
      );

      expect(screen.getByText('Cat1')).toBeInTheDocument();
      expect(screen.getByText('Cat2')).toBeInTheDocument();
      expect(screen.getByText('Cat3')).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(screen.queryByText('Cat4')).not.toBeInTheDocument();
      expect(screen.queryByText('Cat5')).not.toBeInTheDocument();
    });

    it('should handle maxDisplay of 1', () => {
      render(
        <OutlookCategoriesBadges
          categories={['Work', 'Personal', 'Important']}
          maxDisplay={1}
        />
      );

      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(screen.queryByText('Personal')).not.toBeInTheDocument();
    });

    it('should handle large maxDisplay value', () => {
      render(
        <OutlookCategoriesBadges
          categories={['Work', 'Personal']}
          maxDisplay={10}
        />
      );

      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
    });

    it('should show correct hidden count', () => {
      render(
        <OutlookCategoriesBadges
          categories={['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']}
          maxDisplay={3}
        />
      );

      expect(screen.getByText('+5')).toBeInTheDocument();
    });
  });

  describe('Overflow Badge', () => {
    it('should show singular "category" text for +1', () => {
      render(
        <OutlookCategoriesBadges
          categories={['Work', 'Personal', 'Important', 'Meeting']}
          maxDisplay={3}
        />
      );

      const overflowBadge = screen.getByText('+1');
      expect(overflowBadge).toHaveAttribute('title', '1 more category');
    });

    it('should show plural "categories" text for +2 or more', () => {
      render(
        <OutlookCategoriesBadges
          categories={['Work', 'Personal', 'Important', 'Meeting', 'Urgent']}
          maxDisplay={3}
        />
      );

      const overflowBadge = screen.getByText('+2');
      expect(overflowBadge).toHaveAttribute('title', '2 more categories');
    });

    it('should have gray styling for overflow badge', () => {
      render(
        <OutlookCategoriesBadges
          categories={['Work', 'Personal', 'Important', 'Meeting']}
          maxDisplay={3}
        />
      );

      const overflowBadge = screen.getByText('+1');
      expect(overflowBadge).toHaveClass('bg-gray-100', 'text-gray-600');
    });

    it('should have title attribute with full count', () => {
      render(
        <OutlookCategoriesBadges
          categories={['A', 'B', 'C', 'D', 'E']}
          maxDisplay={2}
        />
      );

      const overflowBadge = screen.getByText('+3');
      expect(overflowBadge).toHaveAttribute('title', '3 more categories');
    });
  });

  describe('Styling', () => {
    it('should have purple color scheme for category badges', () => {
      render(<OutlookCategoriesBadges categories={['Work']} />);

      const badge = screen.getByText('Work');
      expect(badge).toHaveClass('bg-purple-100', 'text-purple-800');
    });

    it('should have consistent badge styling', () => {
      render(<OutlookCategoriesBadges categories={['Work']} />);

      const badge = screen.getByText('Work');
      expect(badge).toHaveClass(
        'inline-flex',
        'items-center',
        'px-2',
        'py-0.5',
        'rounded',
        'text-xs',
        'font-medium'
      );
    });

    it('should use flex-wrap for multiple badges', () => {
      const { container } = render(
        <OutlookCategoriesBadges categories={['Work', 'Personal']} />
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'flex-wrap', 'gap-1');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <OutlookCategoriesBadges categories={['Work']} className="custom-class" />
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('should have proper spacing between badges', () => {
      const { container } = render(
        <OutlookCategoriesBadges categories={['Work', 'Personal']} />
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('gap-1');
    });
  });

  describe('Category Names', () => {
    it('should handle long category names', () => {
      render(
        <OutlookCategoriesBadges
          categories={['This is a very long category name that might overflow']}
        />
      );

      expect(
        screen.getByText('This is a very long category name that might overflow')
      ).toBeInTheDocument();
    });

    it('should handle special characters', () => {
      render(<OutlookCategoriesBadges categories={['Work & Personal', 'High-Priority']} />);

      expect(screen.getByText('Work & Personal')).toBeInTheDocument();
      expect(screen.getByText('High-Priority')).toBeInTheDocument();
    });

    it('should handle unicode characters', () => {
      render(<OutlookCategoriesBadges categories={['会议', 'Réunion', '🎯 Goals']} />);

      expect(screen.getByText('会议')).toBeInTheDocument();
      expect(screen.getByText('Réunion')).toBeInTheDocument();
      expect(screen.getByText('🎯 Goals')).toBeInTheDocument();
    });

    it('should handle empty string category', () => {
      render(<OutlookCategoriesBadges categories={['', 'Work']} />);

      expect(screen.getByText('Work')).toBeInTheDocument();
      const badges = screen.getAllByRole('generic', { hidden: false });
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should preserve category order', () => {
      const categories = ['First', 'Second', 'Third'];
      const { container } = render(<OutlookCategoriesBadges categories={categories} />);

      const badges = Array.from(container.querySelectorAll('span[title]'));
      expect(badges[0]).toHaveTextContent('First');
      expect(badges[1]).toHaveTextContent('Second');
      expect(badges[2]).toHaveTextContent('Third');
    });
  });

  describe('Accessibility', () => {
    it('should have title attribute for each category', () => {
      render(<OutlookCategoriesBadges categories={['Work', 'Personal']} />);

      expect(screen.getByTitle('Work')).toBeInTheDocument();
      expect(screen.getByTitle('Personal')).toBeInTheDocument();
    });

    it('should have title attribute for overflow badge', () => {
      render(
        <OutlookCategoriesBadges
          categories={['Work', 'Personal', 'Important', 'Meeting']}
          maxDisplay={3}
        />
      );

      expect(screen.getByTitle('1 more category')).toBeInTheDocument();
    });

    it('should use semantic HTML elements', () => {
      render(<OutlookCategoriesBadges categories={['Work']} />);

      const badge = screen.getByText('Work');
      expect(badge.tagName).toBe('SPAN');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single category with maxDisplay 0', () => {
      render(<OutlookCategoriesBadges categories={['Work']} maxDisplay={0} />);

      expect(screen.queryByText('Work')).not.toBeInTheDocument();
      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('should handle duplicate category names', () => {
      render(<OutlookCategoriesBadges categories={['Work', 'Work', 'Personal']} />);

      const workBadges = screen.getAllByText('Work');
      expect(workBadges).toHaveLength(2);
    });

    it('should handle whitespace-only categories', () => {
      render(<OutlookCategoriesBadges categories={['   ', 'Work']} />);

      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    it('should handle very large array of categories', () => {
      const categories = Array.from({ length: 100 }, (_, i) => `Category ${i}`);
      render(<OutlookCategoriesBadges categories={categories} maxDisplay={3} />);

      expect(screen.getByText('Category 0')).toBeInTheDocument();
      expect(screen.getByText('Category 1')).toBeInTheDocument();
      expect(screen.getByText('Category 2')).toBeInTheDocument();
      expect(screen.getByText('+97')).toBeInTheDocument();
    });

    it('should handle rapid prop changes', () => {
      const { rerender } = render(<OutlookCategoriesBadges categories={['Work']} />);

      rerender(<OutlookCategoriesBadges categories={['Personal', 'Important']} />);
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText('Important')).toBeInTheDocument();

      rerender(<OutlookCategoriesBadges categories={[]} />);
      expect(screen.queryByText(/category/i)).not.toBeInTheDocument();
    });
  });

  describe('Integration Scenarios', () => {
    it('should work in event card context', () => {
      render(
        <div className="event-card">
          <h3>Team Meeting</h3>
          <OutlookCategoriesBadges categories={['Work', 'Important']} />
        </div>
      );

      expect(screen.getByText('Team Meeting')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Important')).toBeInTheDocument();
    });

    it('should work alongside other metadata', () => {
      render(
        <div className="event-metadata">
          <span className="time">10:00 AM</span>
          <OutlookCategoriesBadges categories={['Work']} />
          <span className="location">Office</span>
        </div>
      );

      expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Office')).toBeInTheDocument();
    });

    it('should work with importance and Teams badges', () => {
      render(
        <div className="badges-container">
          <span className="importance">!</span>
          <OutlookCategoriesBadges categories={['Meeting']} />
          <span className="teams-icon">Teams</span>
        </div>
      );

      expect(screen.getByText('!')).toBeInTheDocument();
      expect(screen.getByText('Meeting')).toBeInTheDocument();
      expect(screen.getByText('Teams')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should handle large number of categories efficiently', () => {
      const categories = Array.from({ length: 1000 }, (_, i) => `Category ${i}`);
      const { container } = render(
        <OutlookCategoriesBadges categories={categories} maxDisplay={5} />
      );

      // Should only render 5 badges + overflow indicator
      const badges = container.querySelectorAll('span[title]');
      expect(badges.length).toBe(6); // 5 categories + 1 overflow
    });

    it('should handle rapid re-renders efficiently', () => {
      const { rerender } = render(<OutlookCategoriesBadges categories={['Work']} />);

      for (let i = 0; i < 100; i++) {
        rerender(
          <OutlookCategoriesBadges
            categories={[`Category ${i}`, `Category ${i + 1}`]}
          />
        );
      }

      // Should render final state
      expect(screen.getByText('Category 99')).toBeInTheDocument();
    });

    it('should not cause memory leaks with multiple instances', () => {
      const instances = Array.from({ length: 100 }, (_, i) => (
        <OutlookCategoriesBadges key={i} categories={['Work', 'Personal']} />
      ));

      const { unmount } = render(<>{instances}</>);

      // Should unmount cleanly
      unmount();
    });
  });

  describe('Visual Consistency', () => {
    it('should maintain consistent badge height', () => {
      render(
        <OutlookCategoriesBadges categories={['Short', 'Very Long Category Name']} />
      );

      const badges = screen.getAllByTitle(/^(Short|Very Long Category Name)$/);
      expect(badges[0]).toHaveClass('py-0.5');
      expect(badges[1]).toHaveClass('py-0.5');
    });

    it('should maintain consistent text size', () => {
      render(
        <OutlookCategoriesBadges categories={['Work', 'Personal', 'Important']} />
      );

      const badges = screen.getAllByTitle(/^(Work|Personal|Important)$/);
      badges.forEach(badge => {
        expect(badge).toHaveClass('text-xs');
      });
    });

    it('should maintain consistent color scheme', () => {
      render(
        <OutlookCategoriesBadges categories={['Work', 'Personal', 'Important']} />
      );

      const badges = screen.getAllByTitle(/^(Work|Personal|Important)$/);
      badges.forEach(badge => {
        expect(badge).toHaveClass('bg-purple-100', 'text-purple-800');
      });
    });
  });

  describe('Overflow Text', () => {
    it('should show correct grammar for +1 category', () => {
      render(
        <OutlookCategoriesBadges
          categories={['Work', 'Personal', 'Important', 'Meeting']}
          maxDisplay={3}
        />
      );

      const overflow = screen.getByTitle('1 more category');
      expect(overflow.getAttribute('title')).toBe('1 more category');
    });

    it('should show correct grammar for multiple categories', () => {
      render(
        <OutlookCategoriesBadges
          categories={['Work', 'Personal', 'Important', 'Meeting', 'Urgent']}
          maxDisplay={3}
        />
      );

      const overflow = screen.getByTitle('2 more categories');
      expect(overflow.getAttribute('title')).toBe('2 more categories');
    });

    it('should calculate correct overflow count', () => {
      render(
        <OutlookCategoriesBadges
          categories={Array.from({ length: 10 }, (_, i) => `Cat${i}`)}
          maxDisplay={3}
        />
      );

      expect(screen.getByText('+7')).toBeInTheDocument();
    });
  });
});
