import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock the database module
jest.mock('../database/database', () => ({
  DatabaseManager: jest.fn().mockImplementation(() => ({
    getAllProducts: jest.fn().mockResolvedValue([]),
    getAllCustomers: jest.fn().mockResolvedValue([]),
    addProduct: jest.fn().mockResolvedValue({ id: 1 }),
    addCustomer: jest.fn().mockResolvedValue({ id: 1 }),
  })),
}));

describe('Billing Software Application', () => {
  test('renders main application', () => {
    render(<App />);
    
    // Check if the main navigation elements are present
    expect(screen.getByText('Billing Software')).toBeInTheDocument();
  });

  test('displays dashboard by default', () => {
    render(<App />);
    
    // Check if dashboard content is visible
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  test('navigation sidebar is present', () => {
    render(<App />);
    
    // Check if navigation items are present
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });
});
