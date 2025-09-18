'use client'

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/router'; // для Pages Router
// или для App Router:
// import { useParams } from 'next/navigation';

import HomeScreen from '@/components/HomeScreen'; // Путь может отличаться

const TrackPage = () => {
    // Для Pages Router (pages/track/[id].js)
    const router = useRouter();
    const { id } = router.query;

    // Для App Router (app/track/[id]/page.js)
    // const params = useParams();
    // const id = params.id;

    useEffect(() => {
        // Просто для отладки
        console.log('TrackPage - Получен ID из URL:', id);
    }, [id]);

    return <HomeScreen websocketId={id} />;
};

export default TrackPage;