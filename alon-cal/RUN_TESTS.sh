#!/bin/bash

# Microsoft Outlook Integration - Test Execution Script
# Run this script to execute all tests and generate reports

set -e  # Exit on error

echo "=================================================="
echo "Microsoft Outlook Integration - Test Suite"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Backend Tests
echo -e "${BLUE}Running Backend Tests...${NC}"
cd /Users/natescherer/alon-cal/backend
npm test -- --coverage --coverageReporters=text --coverageReporters=html 2>&1 | tee test-output-backend.txt
BACKEND_EXIT=$?

echo ""
echo -e "${BLUE}Backend tests complete. Exit code: $BACKEND_EXIT${NC}"
echo ""

# Frontend Tests
echo -e "${BLUE}Running Frontend Tests...${NC}"
cd /Users/natescherer/alon-cal/frontend
npm test -- --coverage 2>&1 | tee test-output-frontend.txt
FRONTEND_EXIT=$?

echo ""
echo -e "${BLUE}Frontend tests complete. Exit code: $FRONTEND_EXIT${NC}"
echo ""

# Summary
echo "=================================================="
echo -e "${GREEN}Test Execution Summary${NC}"
echo "=================================================="
echo ""

if [ $BACKEND_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ Backend tests: PASS${NC}"
else
    echo -e "${YELLOW}✗ Backend tests: FAIL (exit code: $BACKEND_EXIT)${NC}"
fi

if [ $FRONTEND_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend tests: PASS${NC}"
else
    echo -e "${YELLOW}✗ Frontend tests: FAIL (exit code: $FRONTEND_EXIT)${NC}"
fi

echo ""
echo "Coverage Reports:"
echo "  Backend:  file:///Users/natescherer/alon-cal/backend/coverage/index.html"
echo "  Frontend: file:///Users/natescherer/alon-cal/frontend/coverage/index.html"
echo ""
echo "Test Outputs:"
echo "  Backend:  /Users/natescherer/alon-cal/backend/test-output-backend.txt"
echo "  Frontend: /Users/natescherer/alon-cal/frontend/test-output-frontend.txt"
echo ""

# Exit with failure if any tests failed
if [ $BACKEND_EXIT -ne 0 ] || [ $FRONTEND_EXIT -ne 0 ]; then
    exit 1
fi

echo -e "${GREEN}All tests passed!${NC}"
exit 0
