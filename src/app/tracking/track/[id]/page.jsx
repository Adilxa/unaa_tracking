'use client'

import { useParams } from 'next/navigation';
import HomeScreen from '../../../../screens/HomeScreen'; // Убедитесь, что путь правильный

export default function TrackPage() {
    const params = useParams();
    const id = params.id;

    console.log('TrackPage - Получен ID из URL:', id);

    return <HomeScreen websocketId={id} />;
}
