// api/shorten.js
import { createClient } from '@supabase/supabase-js';

// Inizializza Supabase Client
// Assicurati che le variabili d'ambiente SUPABASE_URL e SUPABASE_ANON_KEY
// siano impostate correttamente nel tuo progetto Vercel
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// NOTA: Non definire generateShortId qui in alto, verrà definita dopo il dynamic import

export default async function handler(req, res) {
    // Permette solo richieste POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { long_url } = req.body;

    // Validazione base dell'URL lungo
    if (!long_url || (!long_url.startsWith('http://') && !long_url.startsWith('https://'))) {
        return res.status(400).json({ message: 'Invalid URL provided. Please ensure it starts with http:// or https://' });
    }

    try {
        // Esegui il dynamic import per nanoid qui dentro la funzione.
        // Questo risolve l'errore ERR_REQUIRE_ESM.
        const { customAlphabet } = await import('nanoid');
        // Ora puoi definire generateShortId usando customAlphabet
        // Ho corretto la stringa di caratteri da '012345690' a '0123456789'
        const generateShortId = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 7);

        // 1. Controlla se l'URL lungo esiste già nel database
        const { data: existingUrl, error: existingError } = await supabase
            .from('short_urls') // Il nome della tua tabella Supabase
            .select('short_id')
            .eq('long_url', long_url)
            .single();

        if (existingUrl) {
            // Se l'URL lungo esiste già, restituisci l'ID breve esistente
            // Utilizziamo il dominio personalizzato "https://s.reav.space"
            const shortUrl = `https://s.reav.space/${existingUrl.short_id}`;
            return res.status(200).json({ shortUrl });
        }

        // 2. Genera un nuovo short ID unico
        let shortId;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
            shortId = generateShortId();
            const { data: duplicateId, error: duplicateError } = await supabase
                .from('short_urls')
                .select('short_id')
                .eq('short_id', shortId)
                .single();

            if (!duplicateId || (duplicateError && duplicateError.code === 'PGRST116')) {
                isUnique = true; // L'ID è unico e può essere usato
            } else if (duplicateError) {
                // Altri errori di Supabase durante la ricerca
                throw duplicateError;
            }
            attempts++;
        }

        if (!isUnique) {
            return res.status(500).json({ message: 'Failed to generate a unique short ID after multiple attempts.' });
        }

        // 3. Salva l'URL lungo e l'ID breve nel database
        const { data, error } = await supabase
            .from('short_urls')
            .insert([{ long_url, short_id: shortId }])
            .select();

        if (error) {
            console.error('Supabase insert error:', error);
            return res.status(500).json({ message: 'Error saving URL to database.', error: error.message });
        }

        // Costruisci l'URL breve completo usando il dominio personalizzato
        const shortUrl = `https://s.reav.space/${shortId}`;

        // Restituisci l'URL breve generato al client
        res.status(200).json({ shortUrl });

    } catch (error) {
        console.error('Catch all server error in shorten.js:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
}