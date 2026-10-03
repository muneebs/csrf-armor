import {CsrfProvider} from '@csrf-armor/nextjs/client';
import type {Metadata} from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Next.js Demo | CSRF Armor',
    description: 'Interactive demo of CSRF protection strategies using @csrf-armor/nextjs',
};

export default function RootLayout({children}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
        <body style={{fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '2rem auto', padding: '0 1rem'}}>
        <nav style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem'}}>
            <Link href="/">Home</Link>
            <Link href="/form">Form</Link>
            <Link href="/fetch">Fetch</Link>
            <Link href="/actions">Server actions</Link>
        </nav>
        <CsrfProvider>{children}</CsrfProvider>
        </body>
        </html>
    );
}
