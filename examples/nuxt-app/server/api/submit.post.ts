/** API endpoint that handles form submissions. CSRF is validated by the middleware. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return {
    success: true,
    message: 'Form submitted successfully!',
    data: body.data,
    strategy: body.strategy,
  }
})
