# CSRF Armor Express.js Example

<img src="https://cdn.nebz.dev/csrf-armor/logo.jpeg" alt="CSRF Armor" />

This example demonstrates how to use CSRF Armor with Express.js, showcasing all available CSRF protection strategies.

## Prerequisites

- Node.js 18 or higher
- PNPM package manager

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/muneebs/csrf-armor.git
cd csrf-armor

# Install dependencies
pnpm install

# Start the example app
cd examples/express-app
pnpm start
```

Visit `http://localhost:3000` to see the example in action. The homepage provides links to demos of each CSRF protection strategy.

## 🧪 Testing the Strategies

1. Visit the homepage at `http://localhost:3000`
2. Click on any strategy to view its demo
3. Each demo page includes:
   - A form protected by the selected strategy
   - The current CSRF token (if applicable)
   - Submit the form to test the protection
   - Try modifying the token to see the protection in action
---

## 📚 Additional Resources

- [CSRF Armor Core Documentation](../../packages/core)
- [Express.js Adapter Documentation](../../packages/express)

---

**💬 Get Help:**
- 🐛 [Report bugs](https://github.com/muneebs/csrf-armor/issues/new)
- 💡 [Request features](https://github.com/muneebs/csrf-armor/issues/new)
- 💬 [Ask questions](https://github.com/muneebs/csrf-armor/discussions)
