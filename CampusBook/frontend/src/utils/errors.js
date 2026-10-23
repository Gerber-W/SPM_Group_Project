export function errorMessage(error) {
  if (!error.response) return 'We could not reach the server. Check your connection and try again';
  return error.response.data?.error || 'Something went wrong, please try again';
}
