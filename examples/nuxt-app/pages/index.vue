<script setup lang="ts">
useSeoMeta({
  title: 'Strategy Selector',
  description: 'Select a CSRF protection strategy to test with the @csrf-armor/nuxt module.',
})

const strategies = [
  'double-submit',
  'signed-double-submit',
  'signed-token',
  'origin-check',
  'hybrid',
] as const
</script>

<template>
  <div class="container">
    <h1>CSRF Armor Nuxt - Strategy Demo</h1>
    <p>Select a CSRF protection strategy to test:</p>
    <ul>
      <li v-for="strategy in strategies" :key="strategy">
        <NuxtLink :to="`/demo/${strategy}`">{{ strategy }}</NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.container {
  max-width: 640px;
  margin: 2rem auto;
  font-family: system-ui, sans-serif;
}

ul {
  list-style: none;
  padding: 0;
}

li {
  margin: 0.5rem 0;
}

a {
  color: #00dc82;
  text-decoration: none;
  font-size: 1.1rem;
}

a:hover {
  text-decoration: underline;
}
</style>
