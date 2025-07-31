#!/bin/bash

# Health check utility for BookMonarch development services

# Configuration
BACKEND_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

check_http_endpoint() {
    local url=$1
    local service_name=$2
    local timeout=${3:-5}
    
    local response=$(curl -s -w "%{http_code}" -m $timeout "$url" 2>/dev/null || echo "000")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    case $http_code in
        200)
            print_success "$service_name is healthy (HTTP $http_code)"
            return 0
            ;;
        000)
            print_error "$service_name is not responding (connection failed)"
            return 1
            ;;
        *)
            print_warning "$service_name returned HTTP $http_code"
            return 1
            ;;
    esac
}

check_backend_health() {
    echo -e "${CYAN}Backend Health Check:${NC}"
    
    local healthy=true
    
    # Check basic connectivity
    if ! check_http_endpoint "$BACKEND_URL" "Flask Backend"; then
        healthy=false
    fi
    
    # Check health endpoint specifically
    if ! check_http_endpoint "$BACKEND_URL/health" "Flask Health Check"; then
        print_warning "Health endpoint not available, trying root..."
        if ! check_http_endpoint "$BACKEND_URL/" "Flask Root"; then
            healthy=false
        fi
    fi
    
    # Check if we can reach API endpoints
    if ! check_http_endpoint "$BACKEND_URL/api/health" "Flask API Health"; then
        print_warning "API health endpoint not available"
    fi
    
    echo
    if $healthy; then
        return 0
    else
        return 1
    fi
}

check_frontend_health() {
    echo -e "${CYAN}Frontend Health Check:${NC}"
    
    local healthy=true
    
    # Check basic connectivity
    if ! check_http_endpoint "$FRONTEND_URL" "Next.js Frontend"; then
        healthy=false
    fi
    
    # Check if it's actually Next.js (look for common Next.js patterns)
    local response=$(curl -s -m 5 "$FRONTEND_URL" 2>/dev/null || echo "")
    if [[ "$response" == *"__NEXT_DATA__"* ]] || [[ "$response" == *"_next"* ]]; then
        print_success "Next.js application detected"
    else
        print_warning "Response doesn't appear to be from Next.js"
    fi
    
    echo
    if $healthy; then
        return 0
    else
        return 1
    fi
}

check_backend_dependencies() {
    echo -e "${CYAN}Backend Dependencies:${NC}"
    
    local deps_ok=true
    
    # Check if virtual environment exists
    if [ -d "$BACKEND_DIR/venv" ]; then
        print_success "Python virtual environment found"
    else
        print_error "Python virtual environment not found at $BACKEND_DIR/venv"
        deps_ok=false
    fi
    
    # Check if requirements.txt exists
    if [ -f "$BACKEND_DIR/requirements.txt" ]; then
        print_success "Requirements file found"
    else
        print_warning "Requirements file not found"
    fi
    
    # Check if .env file exists
    if [ -f "$BACKEND_DIR/.env" ]; then
        print_success "Environment file found"
    else
        print_error "Environment file not found at $BACKEND_DIR/.env"
        deps_ok=false
    fi
    
    # Check critical Python imports (if we can activate venv)
    if [ -d "$BACKEND_DIR/venv" ]; then
        cd "$BACKEND_DIR"
        if source venv/bin/activate 2>/dev/null; then
            # Test critical imports
            if python -c "import flask" 2>/dev/null; then
                print_success "Flask import successful"
            else
                print_error "Flask import failed"
                deps_ok=false
            fi
            
            if python -c "from supabase import create_client" 2>/dev/null; then
                print_success "Supabase import successful"
            else
                print_error "Supabase import failed"
                deps_ok=false
            fi
            
            deactivate 2>/dev/null || true
        fi
        cd - >/dev/null
    fi
    
    echo
    if $deps_ok; then
        return 0
    else
        return 1
    fi
}

check_frontend_dependencies() {
    echo -e "${CYAN}Frontend Dependencies:${NC}"
    
    local deps_ok=true
    
    # Check if package.json exists
    if [ -f "$FRONTEND_DIR/package.json" ]; then
        print_success "Package.json found"
    else
        print_error "Package.json not found"
        deps_ok=false
    fi
    
    # Check if node_modules exists
    if [ -d "$FRONTEND_DIR/node_modules" ]; then
        print_success "Node modules installed"
    else
        print_error "Node modules not found - run 'npm install' in frontend directory"
        deps_ok=false
    fi
    
    # Check if Next.js is installed
    if [ -f "$FRONTEND_DIR/node_modules/.bin/next" ]; then
        print_success "Next.js binary found"
    else
        print_error "Next.js not properly installed"
        deps_ok=false
    fi
    
    # Check Node version
    local node_version=$(node --version 2>/dev/null || echo "not found")
    if [[ "$node_version" != "not found" ]]; then
        print_success "Node.js version: $node_version"
    else
        print_error "Node.js not found"
        deps_ok=false
    fi
    
    echo
    if $deps_ok; then
        return 0
    else
        return 1
    fi
}

check_database_connectivity() {
    echo -e "${CYAN}Database Connectivity:${NC}"
    
    # Try to check if backend can connect to database
    local db_check_url="$BACKEND_URL/api/health"
    local response=$(curl -s -m 10 "$db_check_url" 2>/dev/null || echo "")
    
    if [[ "$response" == *"success"* ]] || [[ "$response" == *"healthy"* ]]; then
        print_success "Database connectivity appears healthy"
    else
        print_warning "Unable to verify database connectivity"
        print_status "Check backend logs for database connection issues"
    fi
    
    echo
}

run_comprehensive_check() {
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE}  Comprehensive Health Check     ${NC}"
    echo -e "${BLUE}=================================${NC}"
    echo
    
    local overall_health=true
    
    # Check dependencies first
    if ! check_backend_dependencies; then
        overall_health=false
    fi
    
    if ! check_frontend_dependencies; then
        overall_health=false
    fi
    
    # Check service health
    if ! check_backend_health; then
        overall_health=false
    fi
    
    if ! check_frontend_health; then
        overall_health=false
    fi
    
    # Check database
    check_database_connectivity
    
    # Overall status
    echo -e "${CYAN}Overall Health Status:${NC}"
    if $overall_health; then
        print_success "All systems are healthy and ready for development"
    else
        print_error "Some issues detected - see details above"
        echo
        echo "Common fixes:"
        echo "  Backend issues: cd backend && source venv/bin/activate && pip install -r requirements.txt"
        echo "  Frontend issues: cd frontend && npm install"
        echo "  Start servers: ./dev-start.sh"
    fi
    
    if $overall_health; then
        return 0
    else
        return 1
    fi
}

run_quick_check() {
    local backend_ok=true
    local frontend_ok=true
    
    # Quick connectivity test
    curl -s -f "$BACKEND_URL" >/dev/null 2>&1 || backend_ok=false
    curl -s -f "$FRONTEND_URL" >/dev/null 2>&1 || frontend_ok=false
    
    if $backend_ok && $frontend_ok; then
        echo -e "${GREEN}✓${NC} All services are responding"
        return 0
    else
        echo -e "${RED}✗${NC} Some services are not responding"
        $backend_ok || echo -e "  ${RED}✗${NC} Backend not responding"
        $frontend_ok || echo -e "  ${RED}✗${NC} Frontend not responding"
        return 1
    fi
}

show_usage() {
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  full      Run comprehensive health check (default)"
    echo "  quick     Run quick connectivity check"
    echo "  backend   Check backend health only"
    echo "  frontend  Check frontend health only"
    echo "  deps      Check dependencies only"
    echo
    echo "Examples:"
    echo "  $0 full"
    echo "  $0 quick"
    echo "  $0 backend"
}

main() {
    local command=${1:-"full"}
    
    case $command in
        "full")
            run_comprehensive_check
            ;;
        "quick")
            run_quick_check
            ;;
        "backend")
            check_backend_health
            ;;
        "frontend") 
            check_frontend_health
            ;;
        "deps")
            check_backend_dependencies
            check_frontend_dependencies
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"