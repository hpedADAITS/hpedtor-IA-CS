echo -e "${YELLOW}Bootstrapping LMS to load model...${NC}"
~/.lmstudio/bin/lms bootstrap

# Check if lms CLI is available
echo -e "${YELLOW}Checking for LM Studio CLI (lms)...${NC}"

if ! command -v lms &> /dev/null; then
    echo -e "${RED}ERROR: LM Studio CLI (lms) is not installed or not in PATH${NC}"
    echo ""
    echo -e "${CYAN}Please ensure LM Studio is installed with CLI support:${NC}"
    echo "1. Download LM Studio from: https://lmstudio.ai/"
    echo "2. Install using the default installer"
    echo "3. Enable CLI in LM Studio settings: Settings > Advanced > Enable CLI"
    echo "4. The 'lms' command should be available in your PATH"
    echo ""
    echo -e "${CYAN}To verify installation, run: lms --version${NC}"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ LM Studio CLI found${NC}"
echo ""

# Check if LM Studio server is running on port 1234
echo -e "${YELLOW}Checking LM Studio API server...${NC}"

lmStudioRunning=0
if curl -s http://localhost:1234/v1/models > /dev/null 2>&1; then
    echo -e "${GREEN}✓ LM Studio server is already running on port 1234${NC}"
    lmStudioRunning=1

    # Check if a model is loaded
    if command -v jq &> /dev/null; then
        models=$(curl -s http://localhost:1234/v1/models | jq -r '.data[0].id' 2>/dev/null)
        if [ -n "$models" ] && [ "$models" != "null" ]; then
            echo -e "${GREEN}✓ Loaded model: $models${NC}"
        fi
    fi
else
    echo -e "${YELLOW}LM Studio server not detected on port 1234${NC}"
    echo -e "${YELLOW}Starting LM Studio server...${NC}"

    # Start LM Studio server in background
    lms server start > /tmp/lm-studio.log 2>&1 &
    LM_STUDIO_PID=$!
    echo -e "${GREEN}LM Studio server started (PID: $LM_STUDIO_PID)${NC}"

    echo ""
    echo -e "${YELLOW}Waiting for LM Studio server to be ready (this may take up to 30 seconds)...${NC}"

    ready=0
    for i in $(seq 1 30); do
        if curl -s http://localhost:1234/v1/models > /dev/null 2>&1; then
            echo -e "${GREEN}✓ LM Studio server is ready!${NC}"

            # Check for loaded models
            if command -v jq &> /dev/null; then
                models=$(curl -s http://localhost:1234/v1/models | jq -r '.data[0].id' 2>/dev/null)
                if [ -n "$models" ] && [ "$models" != "null" ]; then
                    echo -e "${GREEN}✓ Loaded model: $models${NC}"
                else
                    echo -e "${YELLOW}⚠ Warning: No models are currently loaded${NC}"
                    echo -e "${YELLOW}Please load a model in LM Studio before using the chatbot${NC}"
                fi
            fi

            ready=1
            break
        fi

        if [ $((i % 5)) -eq 0 ] || [ "$i" -eq 30 ]; then
            echo -e "${YELLOW}Waiting... (Attempt $i/30)${NC}"
        fi

        sleep 1
    done

    if [ "$ready" -eq 0 ]; then
        echo -e "${YELLOW}WARNING: LM Studio server may not be fully ready, but continuing...${NC}"
        echo -e "${YELLOW}If the app fails to connect, run: lms server start${NC}"
    fi
fi

echo ""
npm run dev
