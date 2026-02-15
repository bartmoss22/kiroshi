<script>
    import { page } from '$app/state';
</script>

<div class="error-container">
    <h1>{page.status}</h1>
    
    <p>{page.error?.message ?? 'An unexpected error occurred'}</p>
    
    <a href="/">Go back home</a>
</div>