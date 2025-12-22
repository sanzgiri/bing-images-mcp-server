'use server'

import { getBingImage } from '@/lib/mcp';
import { unstable_noStore as noStore } from 'next/cache';

export async function fetchBingImage(country: string = 'us') {
    noStore();
    try {
        const data = await getBingImage(country);
        if (data) {
            return JSON.parse(data);
        }
        return null;
    } catch (error) {
        console.error("Error in fetchBingImage:", error);
        return null;
    }
}
