/**
 * Button Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../components/Button';

describe('Button Component', () => {
  it('should render button with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should render primary variant by default', () => {
    render(<Button>Primary Button</Button>);
    const button = screen.getByText('Primary Button');
    expect(button).toHaveClass('bg-blue-600');
  });

  it('should render secondary variant', () => {
    render(<Button variant="secondary">Secondary Button</Button>);
    const button = screen.getByText('Secondary Button');
    expect(button).toHaveClass('bg-gray-200');
  });

  it('should render danger variant', () => {
    render(<Button variant="danger">Danger Button</Button>);
    const button = screen.getByText('Danger Button');
    expect(button).toHaveClass('bg-red-600');
  });

  it('should show loading state', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('should be disabled when isLoading is true', () => {
    render(<Button isLoading>Submit</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Submit</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should not fire click event when disabled', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Submit</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should render full width when fullWidth is true', () => {
    render(<Button fullWidth>Full Width Button</Button>);
    const button = screen.getByText('Full Width Button');
    expect(button).toHaveClass('w-full');
  });

  it('should accept additional className', () => {
    render(<Button className="custom-class">Custom Button</Button>);
    const button = screen.getByText('Custom Button');
    expect(button).toHaveClass('custom-class');
  });

  it('should pass through additional props', () => {
    render(<Button type="submit" data-testid="submit-btn">Submit</Button>);
    const button = screen.getByTestId('submit-btn');
    expect(button).toHaveAttribute('type', 'submit');
  });
});
