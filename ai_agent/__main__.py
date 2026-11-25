"""Allow running via `python3 -m ai_agent`."""

import sys

from ai_agent.cli import main

if __name__ == "__main__":
    sys.exit(main())
