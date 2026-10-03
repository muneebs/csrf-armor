import {FormTest} from '../csrf-tests';

export default async function FormPage({searchParams}: {
    searchParams: Promise<{submitted?: string}>;
}) {
    const {submitted} = await searchParams;

    return (
        <main>
            <h1>HTML form</h1>
            <p>A plain form post with the token in a hidden <code>csrf_token</code> field.</p>
            <FormTest endpoint="/api/counter" submitted={submitted === 'form'} />
        </main>
    );
}
