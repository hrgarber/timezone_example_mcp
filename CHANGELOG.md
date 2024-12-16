# Changelog

## [Unreleased] - MCP Adaptation

### Added
- Installed @modelcontextprotocol/sdk package for MCP integration
- Created CHANGELOG.md for tracking changes
- Added MCP_ADAPTATION.md with detailed documentation
- Added timezone conversion tool schema
- Added proper TypeScript types for MCP integration

### Changed
- Converted HTTP server implementation to MCP server
- Updated server implementation to use MCP SDK
- Refactored timezone conversion functionality to expose as MCP tool
- Updated tests to verify MCP functionality
- Fixed TypeScript typing issues with DateTime handling
- Enhanced error handling for MCP context

### Migration Steps
1. Initialize git repository and create feature branch ✓
2. Install MCP SDK dependencies ✓
3. Convert HTTP server to MCP server implementation ✓
4. Create MCP tools for timezone conversion ✓
5. Update types to support MCP tool schemas ✓
6. Add proper validation for MCP tool arguments ✓
7. Update tests for MCP implementation ✓
8. Next step: Add server to MCP settings configuration

### Technical Details
- Removed HTTP-specific code and endpoints
- Implemented MCP Server class with StdioServerTransport
- Added tool registration and handling
- Enhanced type safety with proper TypeScript types
- Improved error handling for MCP context
- Added detailed documentation of the adaptation process
- Updated tests to focus on core timezone conversion functionality