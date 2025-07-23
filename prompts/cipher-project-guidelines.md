# {{project_name}} Project Guidelines

*Version {{version}} - Enhanced System Prompt Architecture*

## Project Overview

{{project_name}} is an advanced AI assistant system with sophisticated memory management, knowledge graph integration, and extensible plugin architecture. This document outlines development standards, practices, and guidelines specific to the {{project_name}} project.

## Code Standards & Practices

### Language & Type Safety
- **TypeScript Strict Mode**: All code must use TypeScript with strict mode enabled
- **Type Coverage**: Maintain >95% type coverage across the codebase
- **ESLint + Prettier**: Follow the established linting and formatting rules
- **No Any Types**: Avoid `any` types; use proper type definitions or `unknown`

### Testing Requirements
- **Framework**: {{tech_stack}} - Vitest for unit and integration tests
- **Coverage Target**: >90% test coverage for all new code
- **Test Categories**:
  - Unit tests for individual functions and classes
  - Integration tests for provider interactions
  - End-to-end tests for complete workflows
- **Testing Patterns**:
  - Test both success and error scenarios
  - Mock external dependencies appropriately
  - Use descriptive test names and organize by functionality

### Architecture Principles

#### System Prompt Architecture
- **Plugin-Based Design**: All prompt providers must implement the `PromptProvider` interface
- **Provider Isolation**: Each provider should be independent and not rely on others
- **Error Resilience**: Providers must handle errors gracefully and not crash the system
- **Performance**: Target <100ms generation time for all providers combined

#### Memory & Knowledge Systems
- **Memory Efficiency**: Optimize for both speed and memory usage
- **Context Preservation**: Maintain conversation context across sessions
- **Knowledge Graph**: Leverage relationships between concepts and entities
- **Search Optimization**: Implement efficient similarity search algorithms

### Development Workflow

#### Branch Management
- **Main Branch**: `main` - production-ready code only
- **Feature Branches**: `feat/feature-name` - new features and enhancements
- **Bug Fixes**: `fix/issue-description` - bug fixes and patches
- **Documentation**: `docs/topic` - documentation updates

#### Code Review Process
- **Peer Review**: All changes require review from at least one team member
- **Automated Checks**: CI/CD pipeline must pass (tests, linting, type checking)
- **Documentation**: Update relevant documentation for significant changes
- **Performance**: Consider performance impact of changes

#### Commit Standards
- **Conventional Commits**: Use conventional commit format
- **Clear Messages**: Write descriptive commit messages
- **Atomic Commits**: Each commit should represent a single logical change
- **Examples**:
  - `feat(providers): add file-based provider with hot reloading`
  - `fix(memory): resolve memory leak in context caching`
  - `docs(readme): update installation instructions`

## {{project_name}}-Specific Guidelines

### System Prompt Development
- **Provider Types**: Understand when to use Static, Dynamic, or File-based providers
- **Priority Management**: Assign appropriate priorities (0-100 scale)
- **Context Usage**: Leverage `ProviderContext` effectively for dynamic content
- **Template Variables**: Use consistent variable naming in templates

### Memory Integration
- **Search Strategy**: Always search memory first for relevant context
- **Context Building**: Build comprehensive context from memory results
- **Efficiency**: Use appropriate similarity thresholds and result limits
- **Pattern Recognition**: Identify and leverage conversation patterns

### Knowledge Graph Usage
- **Node Management**: Create meaningful nodes with proper relationships
- **Relationship Types**: Use consistent relationship naming conventions
- **Graph Traversal**: Implement efficient graph search algorithms
- **Data Integrity**: Maintain graph consistency and prevent orphaned nodes

### Tool Integration Guidelines
- **Built-in Tools**: Leverage existing memory and knowledge graph tools
- **Custom Tools**: Follow the established tool interface patterns
- **Error Handling**: Implement comprehensive error handling for all tools
- **Performance**: Monitor and optimize tool execution times

## Communication & Collaboration

### Team Communication
- **{{team_size}}**: Collaborative development with clear communication
- **Async Updates**: Use structured updates for asynchronous work
- **Technical Discussions**: Document architectural decisions and rationale
- **Knowledge Sharing**: Share learnings and best practices with the team

### Documentation Standards
- **Code Documentation**: JSDoc for all public APIs and complex logic
- **Architecture Docs**: Maintain up-to-date architecture documentation
- **Configuration Examples**: Provide clear examples for all configuration options
- **User Guides**: Write comprehensive user guides for new features

### Response Guidelines for AI Assistant
- **Technical Accuracy**: Provide accurate, tested solutions
- **Code Examples**: Include working code examples with explanations
- **Best Practices**: Reference these guidelines in recommendations
- **Context Awareness**: Use memory and knowledge graph for personalized responses
- **Performance Consciousness**: Consider performance implications in suggestions

## Performance & Quality Metrics

### Performance Targets
- **System Prompt Generation**: <100ms average
- **Memory Search**: <500ms for complex queries
- **Knowledge Graph Traversal**: <200ms for standard operations
- **Total Response Time**: <5 seconds end-to-end

### Quality Standards
- **Code Quality**: Maintain high code quality scores
- **Test Coverage**: >90% coverage for all modules
- **Documentation Coverage**: All public APIs documented
- **Error Rate**: <1% error rate in production

### Monitoring & Observability
- **Performance Metrics**: Monitor all performance targets
- **Error Tracking**: Comprehensive error logging and tracking
- **Usage Analytics**: Track feature usage and adoption
- **System Health**: Monitor system health and resource usage

## Security & Compliance

### Security Practices
- **Input Validation**: Validate all user inputs and external data
- **Secret Management**: Never store secrets in code or configuration files
- **Access Control**: Implement appropriate access controls for sensitive operations
- **Audit Logging**: Log security-relevant events and operations

### Data Protection
- **Privacy**: Respect user privacy in memory and knowledge storage
- **Data Retention**: Implement appropriate data retention policies
- **Encryption**: Use encryption for sensitive data storage and transmission
- **Compliance**: Follow relevant data protection regulations

## Troubleshooting & Debugging

### Common Issues
- **Provider Failures**: Check provider configuration and dependencies
- **Performance Issues**: Profile individual providers and optimize
- **Memory Issues**: Monitor memory usage and implement cleanup strategies
- **Integration Problems**: Verify API contracts and data formats

### Debugging Tools
- **Performance Profiling**: Use built-in performance monitoring
- **Provider Testing**: Test individual providers in isolation
- **Configuration Validation**: Validate configurations before deployment
- **Health Checks**: Implement and monitor system health checks

## Future Considerations

### Scalability
- **Horizontal Scaling**: Design for distributed deployment
- **Load Balancing**: Consider load balancing strategies
- **Caching**: Implement intelligent caching mechanisms
- **Resource Management**: Optimize resource usage and allocation

### Extensibility
- **Plugin Architecture**: Maintain clean plugin interfaces
- **API Stability**: Ensure backward compatibility in APIs
- **Configuration Flexibility**: Support diverse configuration needs
- **Integration Points**: Provide clear integration points for extensions

---

*This document is maintained by the {{project_name}} development team and should be updated as the project evolves. For questions or suggestions, please reach out to the team through established communication channels.*

**Last Updated**: Generated dynamically based on current project state
**Tech Stack**: {{tech_stack}}
**Team**: {{team_size}}