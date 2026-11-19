#!/usr/bin/env python3
"""
Analyze and optimize Docker images for size and security.
"""

import argparse
import subprocess
import sys
import json
from pathlib import Path


def run_command(cmd):
    """Run a shell command and return output."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        return None


def analyze_image(image_name):
    """Analyze Docker image for optimization opportunities."""
    
    print(f"\n🔍 Analyzing image: {image_name}\n")
    
    # Get image size
    output = run_command(f"docker images {image_name} --format '{{{{.Size}}}}'")
    if output:
        size = output.strip()
        print(f"📦 Image size: {size}")
    
    # Get layer information
    output = run_command(f"docker history {image_name} --no-trunc --format '{{{{.Size}}}}\t{{{{.CreatedBy}}}}'")
    if output:
        print(f"\n📊 Layer analysis:")
        layers = output.strip().split('\n')
        for i, layer in enumerate(layers[:10], 1):  # Show top 10 layers
            print(f"  {i}. {layer}")
    
    # Check for common optimization opportunities
    print(f"\n💡 Optimization recommendations:")
    
    dockerfile_path = Path("Dockerfile")
    if dockerfile_path.exists():
        content = dockerfile_path.read_text()
        
        recommendations = []
        
        # Check for multi-stage build
        if content.count("FROM") == 1:
            recommendations.append("Consider using multi-stage builds to reduce final image size")
        
        # Check for layer optimization
        if "RUN" in content and "&&" not in content:
            recommendations.append("Combine RUN commands with && to reduce layers")
        
        # Check for .dockerignore
        if not Path(".dockerignore").exists():
            recommendations.append("Create a .dockerignore file to exclude unnecessary files")
        
        # Check for alpine base
        if "alpine" not in content.lower():
            recommendations.append("Consider using Alpine-based images for smaller size")
        
        # Check for package cache cleanup
        if "apt-get" in content and "rm -rf /var/lib/apt/lists/*" not in content:
            recommendations.append("Clean up apt cache with 'rm -rf /var/lib/apt/lists/*'")
        
        if "apk add" in content and "--no-cache" not in content:
            recommendations.append("Use 'apk add --no-cache' to avoid caching package index")
        
        # Check for npm cache
        if "npm install" in content and "npm cache clean" not in content:
            recommendations.append("Clean npm cache with 'npm cache clean --force'")
        
        # Check for user privileges
        if "USER" not in content:
            recommendations.append("Add a non-root USER for better security")
        
        # Check for health check
        if "HEALTHCHECK" not in content:
            recommendations.append("Add HEALTHCHECK instruction for container monitoring")
        
        if recommendations:
            for i, rec in enumerate(recommendations, 1):
                print(f"  {i}. {rec}")
        else:
            print("  ✅ Image follows most best practices!")
    else:
        print("  ⚠️  Dockerfile not found in current directory")
    
    return True


def create_dockerignore():
    """Create a comprehensive .dockerignore file."""
    
    dockerignore_content = """# Git
.git
.gitignore
.gitattributes

# CI/CD
.github
.gitlab-ci.yml
.travis.yml
Jenkinsfile

# Documentation
README.md
CHANGELOG.md
LICENSE
docs/
*.md

# Development files
.vscode/
.idea/
*.swp
*.swo
*~

# Testing
tests/
test/
**/__tests__/
**/*.test.js
**/*.spec.js
jest.config.js
.coverage/
coverage/

# Build artifacts
dist/
build/
target/
*.log

# Dependencies (will be installed during build)
node_modules/
venv/
__pycache__/
*.pyc
*.pyo

# Environment files
.env
.env.*
!.env.example

# Docker
Dockerfile
docker-compose*.yml
.dockerignore

# OS files
.DS_Store
Thumbs.db
"""
    
    dockerignore_path = Path(".dockerignore")
    if dockerignore_path.exists():
        response = input(".dockerignore already exists. Overwrite? (y/N): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return False
    
    dockerignore_path.write_text(dockerignore_content)
    print("✅ Created .dockerignore file")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Analyze and optimize Docker images"
    )
    parser.add_argument(
        "command",
        choices=["analyze", "create-dockerignore"],
        help="Command to execute"
    )
    parser.add_argument(
        "-i", "--image",
        help="Docker image name (for analyze command)"
    )
    
    args = parser.parse_args()
    
    if args.command == "analyze":
        if not args.image:
            print("Error: --image is required for analyze command")
            sys.exit(1)
        success = analyze_image(args.image)
    elif args.command == "create-dockerignore":
        success = create_dockerignore()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
