#!/usr/bin/env bash
# ==============================================================================
# Sovereign Betting Deployment - GitHub Repository Migration Helper
# ==============================================================================
# This script creates a bare mirror clone of the source repository and pushes
# all branches, tags, and commit history to a new GitHub repository.
#
# Usage:
#   ./scripts/migrate-repo.sh [OLD_REPO_OR_USER] [NEW_REPO_OR_USER]
#   ./scripts/migrate-repo.sh --old <old> --new <new> [--ssh|--https] [--dry-run]
# ==============================================================================

set -euo pipefail

# ANSI colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

DEFAULT_REPO_NAME="betting-deployment"
DEFAULT_OLD_OWNER="kcavemanpurge"

OLD_TARGET=""
NEW_TARGET=""
PROTOCOL="https"
DRY_RUN=false

usage() {
  cat << EOF
${BOLD}Usage:${NC}
  $0 [options] [OLD_ACCOUNT_OR_REPO] [NEW_ACCOUNT_OR_REPO]

${BOLD}Options:${NC}
  -o, --old <account|url>   Source GitHub username or full repo URL (Default: ${DEFAULT_OLD_OWNER})
  -n, --new <account|url>   Target GitHub username or full repo URL (Required)
  -p, --protocol <ssh|https> Git protocol to use when constructing URLs (Default: https)
  -d, --dry-run             Simulate actions without cloning or pushing
  -h, --help                Show this help message

${BOLD}Examples:${NC}
  # Interactive mode:
  $0

  # Positional arguments:
  $0 kcavemanpurge my-new-account

  # Specifying custom full URLs:
  $0 --old git@github.com:old-user/betting-deployment.git --new git@github.com:new-user/betting-deployment.git

  # Dry run:
  $0 -o kcavemanpurge -n my-new-account --dry-run
EOF
  exit 0
}

# Parse options
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--old)
      OLD_TARGET="$2"
      shift 2
      ;;
    -n|--new)
      NEW_TARGET="$2"
      shift 2
      ;;
    -p|--protocol)
      PROTOCOL="$2"
      shift 2
      ;;
    -d|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      if [[ -z "$OLD_TARGET" ]]; then
        OLD_TARGET="$1"
      elif [[ -z "$NEW_TARGET" ]]; then
        NEW_TARGET="$1"
      else
        echo -e "${RED}Error: Unknown argument '$1'${NC}"
        usage
      fi
      shift
      ;;
  esac
done

echo -e "${CYAN}${BOLD}=== GitHub Repository Migration Tool ===${NC}\n"

# Verify git command availability
if ! command -v git &> /dev/null; then
  echo -e "${RED}Error: 'git' is not installed or not found in PATH.${NC}"
  exit 1
fi

# Resolve Source Repository URL
if [[ -z "$OLD_TARGET" ]]; then
  read -r -p "Enter source GitHub username or full repo URL [Default: ${DEFAULT_OLD_OWNER}]: " INPUT_OLD
  OLD_TARGET="${INPUT_OLD:-$DEFAULT_OLD_OWNER}"
fi

# Resolve Target Repository URL
if [[ -z "$NEW_TARGET" ]]; then
  read -r -p "Enter target GitHub username or full repo URL: " NEW_TARGET
  if [[ -z "$NEW_TARGET" ]]; then
    echo -e "${RED}Error: Target repository or username is required.${NC}"
    exit 1
  fi
fi

format_repo_url() {
  local target="$1"
  local proto="$2"

  # If it's already a full URL or SSH target
  if [[ "$target" =~ ^https?:// ]] || [[ "$target" =~ ^git@ ]]; then
    echo "$target"
    return
  fi

  # If target is "owner/repo"
  local owner=""
  local repo=""
  if [[ "$target" == *"/"* ]]; then
    owner="${target%%/*}"
    repo="${target##*/}"
  else
    owner="$target"
    repo="$DEFAULT_REPO_NAME"
  fi

  # Strip any trailing .git if present
  repo="${repo%.git}"

  if [[ "$proto" == "ssh" ]]; then
    echo "git@github.com:${owner}/${repo}.git"
  else
    echo "https://github.com/${owner}/${repo}.git"
  fi
}

SRC_URL="$(format_repo_url "$OLD_TARGET" "$PROTOCOL")"
DEST_URL="$(format_repo_url "$NEW_TARGET" "$PROTOCOL")"

echo -e "Source Repository : ${BOLD}${SRC_URL}${NC}"
echo -e "Target Repository : ${BOLD}${DEST_URL}${NC}"
echo -e "Mode              : $(if [ "$DRY_RUN" = true ]; then echo -e "${YELLOW}DRY RUN${NC}"; else echo -e "${GREEN}LIVE MIGRATION${NC}"; fi)"
echo ""

echo -e "${YELLOW}${BOLD}Pre-flight Checklist:${NC}"
echo -e " 1. Ensure you have created the empty repository on the target account."
echo -e " 2. Do NOT initialize the new repo with a README, .gitignore, or license."
echo -e " 3. Verify write permissions and credentials for the target repository."
echo ""

if [ "$DRY_RUN" = false ]; then
  read -r -p "Proceed with bare mirror migration? (y/N): " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Migration cancelled.${NC}"
    exit 0
  fi
fi

# Create a safe temporary directory
TEMP_MIRROR_DIR="$(mktemp -d -t git-mirror-XXXXXX.git)"

# Cleanup trap
cleanup() {
  if [[ -d "$TEMP_MIRROR_DIR" ]]; then
    echo -e "\n${CYAN}Cleaning up temporary mirror workspace...${NC}"
    rm -rf "$TEMP_MIRROR_DIR"
    echo -e "${GREEN}Cleanup complete.${NC}"
  fi
}
trap cleanup EXIT INT TERM

echo ""
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}[DRY RUN] Would execute:${NC}"
  echo -e "  git clone --mirror \"${SRC_URL}\" \"${TEMP_MIRROR_DIR}\""
  echo -e "  cd \"${TEMP_MIRROR_DIR}\""
  echo -e "  git push --mirror \"${DEST_URL}\""
  echo -e "  cd - && rm -rf \"${TEMP_MIRROR_DIR}\""
  echo ""
  echo -e "${GREEN}[DRY RUN] Verification completed successfully.${NC}"
  exit 0
fi

# Step 1: Clone bare mirror
echo -e "${CYAN}Step 1/2: Cloning bare mirror from source...${NC}"
git clone --mirror "$SRC_URL" "$TEMP_MIRROR_DIR"

# Step 2: Push bare mirror to destination
echo -e "\n${CYAN}Step 2/2: Pushing all refs, branches, and tags to destination...${NC}"
cd "$TEMP_MIRROR_DIR"
git push --mirror "$DEST_URL"
cd - > /dev/null

echo -e "\n${GREEN}${BOLD}✓ Repository migration successfully completed!${NC}"
echo -e "All branches, tags, and commits are mirrored to ${BOLD}${DEST_URL}${NC}."
echo ""
echo -e "${BOLD}Next steps for Netlify:${NC}"
echo -e " 1. Go to Netlify App -> Project Settings -> Build & Deploy."
echo -e " 2. In Continuous Deployment, click 'Link a different repository'."
echo -e " 3. Authorize and select your new repository (${DEST_URL})."
echo -e " 4. Verify build settings (Command: npm run build, Publish dir: public)."
echo -e "================================================================================"
