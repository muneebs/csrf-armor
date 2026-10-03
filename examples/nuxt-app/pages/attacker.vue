<script setup lang="ts">
useSeoMeta({
  title: 'Attacker Page',
  description: 'Forged cross-site requests that CSRF Armor should reject.',
})

// Must match an origin the app is served from. Open this page from a
// different origin (http://[::1]:3000/attacker) so the browser sends a
// foreign Origin header, as a real attacker site would.
const target = 'http://localhost:3000/api/submit'
</script>

<template>
  <div class="container">
    <h1>Attacker page</h1>
    <NuxtLink to="/">&larr; Back to Strategy List</NuxtLink>

    <p>
      These plain HTML forms post to <code>{{ target }}</code>, the way a
      malicious site would. Open this page at
      <code>http://[::1]:3000/attacker</code> so it runs from another origin
      (<code>nuxt dev</code> listens on <code>localhost</code> only, so
      <code>127.0.0.1</code> may be refused). Each submission should fail
      with a 403.
    </p>

    <form method="post" :action="target">
      <input type="hidden" name="data" value="forged without a token" />
      <button id="forge-no-token" type="submit">Send forged request (no token)</button>
    </form>

    <form method="post" :action="target">
      <input type="hidden" name="data" value="forged with a guessed token" />
      <input type="hidden" name="_csrf" value="attacker-guessed-token" />
      <button id="forge-guessed-token" type="submit">Send forged request (guessed token)</button>
    </form>

    <p class="hint">
      The browser withholds <code>SameSite=Lax</code> cookies on cross-site
      posts, so the CSRF cookies are missing too. The token check is what
      protects you from same-site attackers, such as a sibling subdomain.
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
}

form {
  margin: 1rem 0;
}

button {
  padding: 0.5rem 1rem;
  background: #dc2626;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.hint {
  color: #666;
  font-size: 0.9rem;
}

a {
  color: #00dc82;
  text-decoration: none;
}
</style>
