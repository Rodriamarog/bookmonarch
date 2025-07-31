#!/bin/bash

# Port conflict detection utility for BookMonarch development

# Configuration
BACKEND_PORT="5000"
FRONTEND_PORT="3000"
COMMON_PORTS=(3000 3001 5000 5001 8000 8080)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

check_port() {
    local port=$1
    local service_name=${2:-"Unknown"}
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -ti:$port 2>/dev/null | head -1)
        local process_info=$(ps -p $pid -o pid,ppid,cmd --no-headers 2>/dev/null || echo "$pid ? unknown")
        
        echo -e "${RED}✗${NC} Port $port ($service_name) - IN USE"
        echo "    Process: $process_info"
        
        # Suggest kill command
        echo "    Kill with: kill $pid  or  sudo lsof -ti:$port | xargs kill -9"
        return 1
    else
        echo -e "${GREEN}✓${NC} Port $port ($service_name) - Available"
        return 0
    fi
}

check_critical_ports() {
    print_status "Checking critical development ports..."
    echo
    
    local conflicts=0
    
    if ! check_port $BACKEND_PORT "Flask Backend"; then
        conflicts=$((conflicts + 1))
    fi
    
    if ! check_port $FRONTEND_PORT "Next.js Frontend"; then  
        conflicts=$((conflicts + 1))
    fi
    
    echo
    return $conflicts
}

check_common_ports() {
    print_status "Checking commonly used development ports..."
    echo
    
    for port in "${COMMON_PORTS[@]}"; do
        check_port $port "Development"
    done
    
    echo
}

suggest_alternatives() {
    local port=$1
    local service=$2
    
    echo "Alternative ports for $service:"
    for alt_port in $(seq $((port + 1)) $((port + 10))); do
        if ! lsof -Pi :$alt_port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "  $alt_port - Available"
            break
        fi
    done
}

kill_port_process() {
    local port=$1
    
    if [ -z "$port" ]; then
        print_error "Usage: $0 kill <port>"
        return 1
    fi
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -ti:$port 2>/dev/null | head -1)
        local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        
        print_warning "Killing process $pid ($process_name) on port $port"
        
        # Try graceful kill first
        if kill $pid 2>/dev/null; then
            sleep 2
            
            # Check if still running
            if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
                print_warning "Process still running, force killing..."
                kill -9 $pid 2>/dev/null || true
            fi
            
            print_status "Process killed successfully"
        else
            print_error "Failed to kill process. Try: sudo lsof -ti:$port | xargs kill -9"
        fi
    else
        print_status "No process found on port $port"
    fi
}

show_usage() {
    echo "Usage: $0 [command] [options]"
    echo
    echo "Commands:"
    echo "  check     Check critical development ports (default)"
    echo "  all       Check all common development ports"
    echo "  kill <port>  Kill process using specified port"
    echo "  clean     Kill processes on critical ports"
    echo
    echo "Examples:"
    echo "  $0 check"
    echo "  $0 all"
    echo "  $0 kill 3000" 
    echo "  $0 clean"
}

clean_critical_ports() {
    print_status "Cleaning critical development ports..."
    
    for port in $BACKEND_PORT $FRONTEND_PORT; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            kill_port_process $port
        fi
    done
}

main() {
    local command=${1:-"check"}
    
    case $command in
        "check")
            if ! check_critical_ports; then
                echo "Some ports are in use. Use '$0 clean' to free them."
                exit 1
            fi
            ;;
        "all")
            check_common_ports
            ;;
        "kill")
            kill_port_process "$2"
            ;;
        "clean")
            clean_critical_ports
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