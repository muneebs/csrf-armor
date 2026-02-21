<script setup lang="ts">
const route = useRoute()
const strategy = route.params.strategy as string

useSeoMeta({
  title: `${strategy} Demo`,
  description: `Interactive demo of the ${strategy} CSRF protection strategy.`,
})

const { csrfToken, csrfFetch } = useCsrfToken()

const formData = ref('')
const result = ref<{ success: boolean; message: string } | null>(null)
const error = ref<string | null>(null)

/** Strategy-specific notes matching the express example. */
const strategyNotes: Record<string, string> = {
  'double-submit':
    'Compares a token sent in a cookie with a token sent in the request body/header. No secret needed.',
  'signed-double-submit':
    'Similar to double-submit, but the cookie token is signed. Requires a secret.',
  'signed-token':
    'A stateless strategy where a signed token is generated and provided to the client. Requires a secret.',
  'origin-check':
    'Validates the Origin and/or Referer headers against allowed origins. No explicit token in form.',
  hybrid:
    'Combines signed-token and origin-check. Requires a secret and allowedOrigins.',
}

async function handleSubmit() {
  result.value = null
  error.value = null

  try {
    const response = await csrfFetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: formData.value, strategy }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      error.value = errorData?.data?.reason ?? `Request failed with status ${response.status}`
      return
    }

    result.value = await response.json()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unexpected error'
  }
}
</script>

<template>
  <div class="container">
    <h1>
      Strategy: <code>{{ strategy }}</code>
    </h1>

    <NuxtLink to="/">&larr; Back to Strategy List</NuxtLink>

    <p v-if="strategy !== 'origin-check'" class="token">
      CSRF Token: <code>{{ csrfToken ?? 'N/A' }}</code>
    </p>

    <p v-if="strategyNotes[strategy]" class="notes">
      <strong>Notes:</strong> {{ strategyNotes[strategy] }}
    </p>

    <form @submit.prevent="handleSubmit">
      <label for="data">Enter some data:</label>
      <input
        id="data"
        v-model="formData"
        type="text"
        :placeholder="`Hello ${strategy} CSRF`"
      />
      <button type="submit">Submit with {{ strategy }}</button>
    </form>

    <div v-if="result" class="success">
      {{ result.message }}
    </div>

    <div v-if="error" class="error">
      CSRF validation failed: {{ error }}
    </div>

    <hr />
    <p class="hint">
      Try submitting with a modified or missing token (if applicable) to see it fail.
    </p>
  </div>
</template>

<style scoped>
.container {
  max-width: 640px;
  margin: 2rem auto;
  font-family: system-ui, sans-serif;
}

code {
  background: #f0f0f0;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.9em;
  word-break: break-all;
}

.token {
  margin: 1rem 0;
}

.notes {
  background: #f8f8f8;
  padding: 0.75rem;
  border-left: 3px solid #00dc82;
  margin: 1rem 0;
}

form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 1.5rem 0;
}

input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  padding: 0.5rem 1rem;
  background: #00dc82;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

button:hover {
  background: #00b86b;
}

.success {
  color: #166534;
  background: #dcfce7;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.error {
  color: #991b1b;
  background: #fee2e2;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.hint {
  color: #666;
  font-size: 0.9rem;
}

a {
  color: #00dc82;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>
