'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock } from 'lucide-react';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import styles from "./HomeScreen.module.scss"

const HomeScreen = ({ websocketId: propWebsocketId }) => {
    // State для хранения данных WebSocket
    const [orderData, setOrderData] = useState({
        id: 0,
        client_name: "",
        client_phone: "",
        employee_name: "",
        package_details: [],
        total_price: "0.00",
        status: "pending",
        created_at: "",
        started_at: "",
        total_duration: 0,
        updated_at: "",
        queue_position: 0
    });

    // Статус соединения
    const [connected, setConnected] = useState(false);

    // Состояние ошибки
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    // Отслеживание прогресса
    const [progress, setProgress] = useState(0);
    const [remainingTime, setRemainingTime] = useState(orderData.total_duration);

    // Для отслеживания попыток переподключения
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const maxReconnectAttempts = 5;

    // Для адаптивного strokeWidth
    const [strokeWidth, setStrokeWidth] = useState(10);

    // Отладочная информация
    const [debugInfo, setDebugInfo] = useState({
        wsUrl: '',
        connectionAttempts: 0,
        lastError: '',
        serverReachable: false,
        websocketState: 'CONNECTING'
    });

    // Храним WebSocket в ref, чтобы избежать лишних ре-рендеров
    const socketRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const connectionTimeoutRef = useRef(null);
    const processingDataRef = useRef(false);

    // ID заказа
    const websocketIdRef = useRef(null);

    // ID для toast уведомления
    const toastId = "reconnect-toast";

    // Функция проверки доступности сервера
    const checkServerHealth = async () => {
        try {
            console.log("🔍 Проверка доступности WebSocket сервера...");

            // Проверяем доступность WebSocket сервера
            const response = await fetch('https://tracking.belektech.kg/health', {
                method: 'GET',
                mode: 'cors' // Используем CORS для проверки
            }).catch(() => {
                // Если /health недоступен, пробуем основной домен
                return fetch('https://tracking.belektech.kg/', {
                    method: 'HEAD',
                    mode: 'no-cors'
                });
            });

            console.log("✅ WebSocket сервер отвечает");
            setDebugInfo(prev => ({ ...prev, serverReachable: true }));

        } catch (error) {
            console.error("❌ WebSocket сервер недоступен:", error);
            setDebugInfo(prev => ({
                ...prev,
                serverReachable: false,
                lastError: error.message
            }));
        }
    };

    // Инициализируем ID заказа один раз
    useEffect(() => {
        console.log("=== ДИАГНОСТИКА ID ===");
        console.log("propWebsocketId:", propWebsocketId);
        console.log("window.location.href:", window.location.href);
        console.log("window.location.hash:", window.location.hash);
        console.log("window.location.search:", window.location.search);
        console.log("window.location.pathname:", window.location.pathname);

        let wsId = propWebsocketId;

        if (!wsId) {
            // Проверяем hash в URL
            if (window.location.hash && window.location.hash.length > 1) {
                wsId = window.location.hash.substring(1);
                console.log("✅ ID получен из hash:", wsId);
            }

            // Проверяем query параметры
            if (!wsId) {
                const urlParams = new URLSearchParams(window.location.search);
                wsId = urlParams.get('id');
                console.log("🔍 Проверка query params:", urlParams.toString());
                console.log("✅ ID получен из query params:", wsId);
            }

            // Проверяем путь /track/ID
            if (!wsId && window.location.pathname.includes('/track/')) {
                const pathParts = window.location.pathname.split('/');
                console.log("🔍 Части пути:", pathParts);
                for (let i = 0; i < pathParts.length; i++) {
                    if (pathParts[i] === 'track' && pathParts[i + 1]) {
                        wsId = pathParts[i + 1];
                        console.log("✅ ID получен из path:", wsId);
                        break;
                    }
                }
            }
        }

        if (wsId) {
            console.log("🎯 Итоговый ID заказа:", wsId);
            websocketIdRef.current = wsId;

            // Проверяем доступность сервера
            checkServerHealth();
        } else {
            console.error('❌ ID заказа не найден');
            setError('Не удалось найти ID заказа. Пожалуйста, отсканируйте QR-код снова.');
            setLoading(false);
        }
    }, [propWebsocketId]);

    // Функция для обработки данных
    const processOrderData = useCallback((data) => {
        // Предотвращаем параллельную обработку
        if (processingDataRef.current) return;
        processingDataRef.current = true;

        try {
            console.log("📦 Обработка полученных данных:", data);

            // Преобразуем данные перед сохранением в state
            const processedData = {
                id: data.id || 0,
                client_name: data.client_name || "Нет данных",
                client_phone: data.client_phone || "",
                employee_name: data.employee_name || "",
                // Проверяем, является ли package_details массивом
                package_details: Array.isArray(data.package_details) ? data.package_details : [],
                total_price: data.total_price || "0.00",
                status: data.status || "pending",
                created_at: data.created_at || new Date().toISOString(),
                updated_at: data.updated_at || new Date().toISOString(),
                queue_position: data.queue_position !== undefined ? data.queue_position : 0,
                started_at: data.started_at,
                total_duration: data.total_duration,
                car_brand: data.car_brand,
                car_model: data.car_model,
                car_license_plate: data.car_license_plate,
                branch_phone: data.branch_phone
            };

            // Применяем обновления только если данные изменились
            setOrderData(prev => {
                // Сравниваем объекты
                if (JSON.stringify(prev) === JSON.stringify(processedData)) {
                    return prev; // Нет изменений
                }
                console.log("🔄 Обновление данных заказа");
                return processedData;
            });

            // Расчет прогресса и оставшегося времени на основе статуса
            if (data.status === "in_progress" && data.started_at) {
                const startedAtTime = new Date(data.started_at);
                const now = new Date();
                const elapsedMinutes = Math.floor((now - startedAtTime) / (1000 * 60)); // время в минутах

                // Предполагаем, что полный сервис занимает 90 минут
                const totalServiceTime = data.total_duration;

                // Прогресс от 100 до 0
                const newProgress = Math.max(100 - Math.floor((elapsedMinutes / totalServiceTime) * 100), 0);
                setProgress(newProgress);

                // Оставшееся время (90 минут минус прошедшее время)
                const remainingMins = Math.max(totalServiceTime - elapsedMinutes, 0);
                setRemainingTime(remainingMins);
            } else if (data.status === "completed") {
                setProgress(0); // При завершении заказ полностью обработан
                setRemainingTime(0);
            } else if (data.status === "pending") {
                // Для ожидающих заказов показываем начальный прогресс (например, 100%)
                setProgress(100);
                setRemainingTime(data.total_duration || 90); // Время до начала работы, если нужно
            }

        } catch (error) {
            console.error('Ошибка обработки данных:', error);
            setDebugInfo(prev => ({ ...prev, lastError: error.message }));
        } finally {
            processingDataRef.current = false;
        }
    }, []);

    // Функция для создания WebSocket соединения
    const createWebSocketConnection = useCallback(() => {
        if (!websocketIdRef.current) {
            console.error("❌ Нет websocketId для подключения");
            return;
        }

        console.log("=== СОЗДАНИЕ WEBSOCKET ===");

        // Очищаем предыдущие таймеры и соединения
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
        }

        if (socketRef.current) {
            console.log("🧹 Закрываем предыдущее соединение");
            socketRef.current.onopen = null;
            socketRef.current.onmessage = null;
            socketRef.current.onerror = null;
            socketRef.current.onclose = null;
            socketRef.current.close();
        }

        // Правильный WebSocket URL для вашей архитектуры
        const wsUrl = `wss://tracking.belektech.kg/ws/order/${websocketIdRef.current}/`;

        console.log('🔗 URL для подключения:', wsUrl);

        setDebugInfo(prev => ({
            ...prev,
            wsUrl,
            connectionAttempts: prev.connectionAttempts + 1,
            websocketState: 'CONNECTING'
        }));

        try {
            console.log("🚀 Создаем WebSocket...");
            socketRef.current = new WebSocket(wsUrl);
            console.log("✅ WebSocket объект создан");

            // Логируем состояние WebSocket
            console.log("📊 Начальное состояние WebSocket:", socketRef.current.readyState);

        } catch (err) {
            console.error('❌ Ошибка создания WebSocket:', err);
            setDebugInfo(prev => ({
                ...prev,
                lastError: err.message,
                websocketState: 'ERROR'
            }));
            setError('Не удалось подключиться к серверу. Пожалуйста, проверьте соединение и попробуйте снова.');
            setLoading(false);
            return;
        }

        // Устанавливаем таймаут на подключение (увеличиваем до 15 секунд)
        connectionTimeoutRef.current = setTimeout(() => {
            console.error('⏰ Превышено время ожидания WebSocket подключения');
            console.log("📊 Состояние WebSocket при таймауте:", socketRef.current?.readyState);

            if (!connected) {
                setDebugInfo(prev => ({
                    ...prev,
                    websocketState: 'TIMEOUT',
                    lastError: 'Connection timeout'
                }));

                socketRef.current?.close();

                if (reconnectAttempt < maxReconnectAttempts) {
                    console.log(`🔄 Попытка переподключения ${reconnectAttempt + 1} из ${maxReconnectAttempts}`);
                    setReconnectAttempt(prev => prev + 1);
                } else {
                    setError('Превышено время ожидания подключения. Пожалуйста, попробуйте позже.');
                    setLoading(false);
                }
            }
        }, 15000); // Увеличиваем таймаут до 15 секунд

        // Успешное подключение
        socketRef.current.onopen = (event) => {
            console.log('🎉 WebSocket соединение установлено!');
            console.log('📊 Событие onopen:', event);
            console.log('📊 Состояние WebSocket:', socketRef.current.readyState);

            clearTimeout(connectionTimeoutRef.current);
            setConnected(true);
            setLoading(false);
            setReconnectAttempt(0);
            setDebugInfo(prev => ({
                ...prev,
                lastError: '',
                websocketState: 'OPEN'
            }));
        };

        // Получение сообщений
        socketRef.current.onmessage = (event) => {
            console.log('📨 Получено сообщение:', event.data);
            try {
                const data = JSON.parse(event.data);
                console.log('📦 Распарсенные данные:', data);
                processOrderData(data);
            } catch (error) {
                console.error('❌ Ошибка обработки данных:', error);
                setDebugInfo(prev => ({ ...prev, lastError: error.message }));
            }
        };

        // Обработка ошибок
        socketRef.current.onerror = (error) => {
            console.error('❌ Ошибка WebSocket:', error);
            console.log('📊 Состояние WebSocket при ошибке:', socketRef.current?.readyState);

            setConnected(false);
            setDebugInfo(prev => ({
                ...prev,
                lastError: 'WebSocket error occurred',
                websocketState: 'ERROR'
            }));

            if (reconnectAttempt < maxReconnectAttempts) {
                console.log(`🔄 Ошибка соединения. Попытка переподключения ${reconnectAttempt + 1} из ${maxReconnectAttempts}`);
                setReconnectAttempt(prev => prev + 1);
            } else {
                setError('Произошла ошибка при подключении к серверу. Пожалуйста, попробуйте позже.');
                setLoading(false);
            }
        };

        // Обработка закрытия соединения
        socketRef.current.onclose = (event) => {
            console.log('🔚 WebSocket соединение закрыто');
            console.log(`📊 Код: ${event.code}, Причина: ${event.reason}`);
            console.log('📊 wasClean:', event.wasClean);

            setConnected(false);
            setDebugInfo(prev => ({
                ...prev,
                websocketState: 'CLOSED',
                lastError: `Closed: ${event.code} - ${event.reason}`
            }));

            if (event.code === 1000) {
                console.log('⚠️ Получен код 1000: ссылка недействительна');

                if (reconnectTimerRef.current) {
                    clearTimeout(reconnectTimerRef.current);
                }
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                }

                setReconnectAttempt(maxReconnectAttempts + 1);

                toast.error('Ссылка недействительна. Подключение прекращено.', {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                });

                setLoading(false);
                setError('Ссылка недействительна. Пожалуйста, отсканируйте QR-код снова.');
                return;
            }

            if (reconnectAttempt < maxReconnectAttempts) {
                console.log(`🔄 Соединение закрыто. Попытка переподключения ${reconnectAttempt + 1} из ${maxReconnectAttempts}`);

                if (reconnectTimerRef.current) {
                    clearTimeout(reconnectTimerRef.current);
                }

                reconnectTimerRef.current = setTimeout(() => {
                    setReconnectAttempt(prev => prev + 1);
                }, 3000);
            } else if (loading) {
                setError('Соединение закрыто. Не удалось получить данные заказа.');
                setLoading(false);
            }
        };
    }, [connected, reconnectAttempt, loading, processOrderData]);

    // Эффект для переподключения
    useEffect(() => {
        if (websocketIdRef.current) {
            createWebSocketConnection();
        }

        // Очистка при размонтировании компонента
        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }

            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
            }

            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
        };
    }, [reconnectAttempt, createWebSocketConnection]);

    // Добавляем оптимизацию обновления времени
    useEffect(() => {
        if (orderData.status === "in_progress" && connected) {
            const updateTime = () => {
                const startedTime = new Date(orderData?.started_at);
                const now = new Date();
                const elapsedMinutes = Math.floor((now - startedTime) / (1000 * 60));

                const totalServiceTime = orderData.total_duration; // В минутах
                const remainingMins = Math.max(totalServiceTime - elapsedMinutes, 0); // Оставшееся время

                // Прогресс в процентах (макс. 100%)
                const newProgress = Math.min(Math.ceil((elapsedMinutes / totalServiceTime) * 100), 100);

                setProgress(newProgress);
                setRemainingTime(remainingMins);
                console.log('⏰ Обновление времени:', remainingMins);
            };

            updateTime(); // Вызываем сразу, чтобы не ждать 1 минуту
            const intervalId = setInterval(updateTime, 60000); // Обновление раз в минуту

            return () => clearInterval(intervalId);
        }
    }, [orderData, connected, remainingTime]);

    // Уведомление о переподключении
    useEffect(() => {
        if (!connected && !toast.isActive(toastId) && reconnectAttempt > 0) {
            toast.warn("Переподключение...", {
                toastId,
                position: "top-center",
                autoClose: false,
                hideProgressBar: true,
                closeOnClick: false,
                draggable: false,
                className: "bg-red-100 text-red-600 text-xs text-center rounded-full px-4 py-1",
            });
        } else if (connected) {
            toast.dismiss(toastId);
        }
    }, [connected, toastId, reconnectAttempt]);

    useEffect(() => {
        // Проверка на изменение статуса и вывод success toast
        if (orderData.status === "completed" && connected && !toast.isActive('completed-toast')) {
            toast.success("Ваша машина готова!", {
                toastId: 'completed-toast',
                position: "top-center",
                autoClose: 5000, // Закрывается через 5 секунд
                hideProgressBar: false,
                closeOnClick: true,
                draggable: true,
                className: "bg-green-100 text-green-600 text-xs text-center rounded-full px-4 py-1",
            });
        }
    }, [orderData.status, connected]);

    // Обновление strokeWidth для адаптивного дизайна
    useEffect(() => {
        const updateStrokeWidth = () => {
            setStrokeWidth(window.innerWidth >= 640 ? 10 : 7);
        };

        updateStrokeWidth();
        window.addEventListener("resize", updateStrokeWidth);

        return () => window.removeEventListener("resize", updateStrokeWidth);
    }, []);

    // Форматирование номера телефона
    const formatPhone = (phone) => {
        if (!phone) return "";
        // Проверяем длину номера перед форматированием
        if (phone.length < 10) return phone;
        return `+${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`;
    };

    // Получение названия пакета
    const getPackageName = () => {
        if (orderData.package_details && orderData.package_details.length > 0) {
            return orderData.package_details[0]?.name || "Нет названия";
        }
        return "Нет данных";
    };

    // Форматирование времени как mm:ss
    const formatTime = (minutes) => {
        const mins = Math.floor(minutes);
        const secs = Math.floor((minutes - mins) * 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // Получение текста статуса на русском
    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return 'Ожидание';
            case 'in_progress': return 'В процессе';
            case 'completed': return 'Завершено';
            default: return 'Статус неизвестен';
        }
    };

    // Получение классов цветов для статуса
    const getStatusClasses = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-700';
            case 'in_progress': return 'bg-blue-100 text-blue-700';
            case 'completed': return 'bg-green-100 text-green-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const [activeStatus, setActiveStatus] = useState(orderData?.status || null);

    useEffect(() => {
        // Обновляем activeStatus только если orderData.status отличается от текущего activeStatus
        if (orderData.status !== activeStatus) {
            setActiveStatus(orderData.status);
        }
    }, [orderData.status, activeStatus]);

    // Если загрузка или ошибка, показываем соответствующий экран
    if (loading) {
        return (
            <div className="flex justify-center items-center bg-[#E8E8E8] w-full min-h-screen">
                <div className="w-full max-w-sm bg-white relative p-6 text-center">
                    <div className="my-8">
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Загрузка данных заказа...</p>

                        {/* ОТЛАДОЧНАЯ ИНФОРМАЦИЯ */}
                        <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-left overflow-auto max-h-40">
                            <div className="mb-2"><strong>WebSocket ID:</strong> {websocketIdRef.current || '❌ НЕ НАЙДЕН'}</div>
                            <div className="mb-2"><strong>URL:</strong> {debugInfo.wsUrl || 'Не установлен'}</div>
                            <div className="mb-2"><strong>Состояние WS:</strong> {debugInfo.websocketState}</div>
                            <div className="mb-2"><strong>Попыток подключения:</strong> {debugInfo.connectionAttempts}</div>
                            <div className="mb-2"><strong>Сервер доступен:</strong> {debugInfo.serverReachable ? '✅ Да' : '❌ Нет'}</div>
                            {debugInfo.lastError && (
                                <div className="mb-2 text-red-600"><strong>Последняя ошибка:</strong> {debugInfo.lastError}</div>
                            )}
                            <div className="mt-2 pt-2 border-t border-gray-300">
                                <div><strong>Текущий URL:</strong> {window.location.href}</div>
                                <div><strong>Hash:</strong> {window.location.hash || 'Нет'}</div>
                                <div><strong>Search:</strong> {window.location.search || 'Нет'}</div>
                                <div><strong>Pathname:</strong> {window.location.pathname}</div>
                            </div>
                        </div>

                        {reconnectAttempt > 0 && (
                            <p className="text-sm text-gray-500 mt-2">
                                Попытка подключения: {reconnectAttempt} из {maxReconnectAttempts}
                            </p>
                        )}

                        {/* Кнопки для ручного тестирования */}
                        <div className="mt-4 space-y-2">
                            <button
                                onClick={checkServerHealth}
                                className="px-3 py-1 bg-blue-500 text-white rounded text-xs"
                            >
                                Проверить сервер
                            </button>
                            <button
                                onClick={() => {
                                    console.log('=== РУЧНАЯ ДИАГНОСТИКА ===');
                                    console.log('websocketIdRef.current:', websocketIdRef.current);
                                    console.log('debugInfo:', debugInfo);
                                    console.log('socketRef.current:', socketRef.current);
                                    if (socketRef.current) {
                                        console.log('Socket readyState:', socketRef.current.readyState);
                                    }

                                    // Попытка ручного подключения
                                    if (websocketIdRef.current) {
                                        const testWs = new WebSocket(`wss://tracking.belektech.kg/ws/order/${websocketIdRef.current}/`);
                                        testWs.onopen = () => console.log('✅ Тестовое WebSocket подключение успешно!');
                                        testWs.onerror = (error) => console.error('❌ Ошибка тестового WebSocket:', error);
                                        testWs.onclose = (event) => console.log('🔚 Тестовое WebSocket закрыто:', event.code, event.reason);
                                        testWs.onmessage = (event) => console.log('📨 Тестовое сообщение:', event.data);
                                    }
                                }}
                                className="px-3 py-1 bg-green-500 text-white rounded text-xs ml-2"
                            >
                                Тест в консоли
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center bg-[#E8E8E8] w-full min-h-screen">
                <div className="w-full max-w-sm bg-white relative p-6 text-center">
                    <div className="my-8">
                        <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                            <span className="text-red-500 text-2xl">!</span>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Ошибка</h3>
                        <p className="text-gray-600 mb-4">{error}</p>

                        {/* Отладочная информация при ошибке */}
                        <div className="mt-4 p-3 bg-red-50 rounded text-xs text-left">
                            <div><strong>Последняя ошибка:</strong> {debugInfo.lastError}</div>
                            <div><strong>WebSocket URL:</strong> {debugInfo.wsUrl}</div>
                            <div><strong>Состояние:</strong> {debugInfo.websocketState}</div>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-blue-500 text-white rounded-full mt-4"
                        >
                            Повторить
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center items-center bg-[#E8E8E8] w-full min-h-[100dvh] px-4 sm:px-6 md:px-8">
            <div className="w-full max-w-sm bg-[#E8E8E8] relative p-4 pb-6">
                {/* Header with logo */}
                <div className="flex justify-center my-4">
                    <div className="flex items-center">
                        <div>
                            <img src='/images/logo.svg' alt='logo' />
                        </div>
                    </div>
                </div>

                {/* Queue information */}
                {
                    orderData.status !== "completed" && orderData.status !== "in_progress" ? (
                        <div className="bg-gray-100 rounded-full px-6 py-2 mx-auto w-fit my-4">
                            <span className="text-gray-600">Ваше авто на очереди: <span className="font-bold">{orderData.queue_position}</span></span>
                        </div>
                    ) : ""
                }

                {/* Toast для уведомлений о переподключении */}
                <ToastContainer />

                {/* Progress circle */}
                <div className="relative flex justify-center my-8">
                    <div className="absolute w-70 sm:w-72 md:w-80 h-64 sm:h-72 md:h-80 z-10 sm:mt-[-20px]">
                        <CircularProgressbar
                            value={
                                orderData.status === "pending" ? 0 :
                                    orderData.status === "in_progress" ? progress :
                                        orderData.status === "completed" ? 100 : 0
                            }
                            strokeWidth={strokeWidth}
                            styles={{
                                path: {
                                    stroke: '#B2D0EB',
                                    strokeLinecap: 'round',
                                    transform: 'rotate(-140deg)',
                                    transformOrigin: 'center center',
                                    background: 'linear-gradient(180deg, #B1CFEC 0%, #CADFE8 52.69%, #E3E2E4 90.33%)',
                                    boxShadow: '0px 4px 22.8px 0px #0B52C71A inset',
                                },
                                trail: {
                                    stroke: 'transparent',
                                },
                                text: {
                                    fill: '#4db8ff',
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                },
                            }}
                        />
                    </div>

                    <div className="w-48 h-48 rounded-full flex items-center justify-center">
                        <div className="w-40 h-40 rounded-full flex items-center justify-center">
                            <div className="w-36 h-36 rounded-full bg-white flex flex-col items-center justify-center">
                                {orderData.status !== "completed" ? (<img src='/images/clock.svg' alt='clock' style={{ zIndex: "20", marginBottom: '10px' }} />) : ""}
                                <img style={{ position: 'absolute', zIndex: '10', marginTop: '85px' }} src='/images/clock_mask.png' alt='background' />

                                {
                                    orderData.status !== "completed" ? (
                                        <>
                                            <span className="text-5xl font-bold text-white-700" style={{ zIndex: "20" }}>{orderData.status !== "pending" ? progress : 0}%</span>

                                            <span className="text-sm text-white-500" style={{ zIndex: "20" }}>Осталось: {orderData.status !== "pending" ? remainingTime : 0} мин</span>
                                        </>
                                    ) : ""
                                }
                                {
                                    orderData.status === "completed" ? (
                                        <>
                                            <img style={{ zIndex: "50" }} src='/images/success.svg' alt='successIcon' />
                                            <p className={styles.success_text}>Мойка завершена!</p>
                                        </>
                                    ) : ""
                                }
                            </div>
                        </div>
                    </div>
                </div>

                {/* Car image */}
                <div className="relative flex justify-center -mt-4 mb-2 h-57 z-40">
                    <img
                        src="/images/car.png"
                        alt="Car"
                        className="w-64"
                        style={{ objectFit: 'contain' }}
                    />
                </div>

                {/* Car info and call section */}
                <div className='bg-gray-50 rounded-2xl p-7 mt-4'>
                    <div className="flex justify-between">
                        <div className='flex flex-col'>
                            <p className={styles.car_detail_text}>Данные заказа</p>
                            <p className={` ${styles.car_text}`}>{orderData.car_brand} {orderData.car_model}</p>
                            <p className={styles.car_text} style={{ color: "#1E1E1E" }}>{orderData.car_license_plate}</p>
                        </div>
                        <div className='right_content'>
                            <a href={`tel:${orderData.branch_phone}`} className="bg-black text-white rounded-full px-4 py-2 font-medium">
                                Позвонить
                            </a>
                            {/* Time display */}
                            <div className="flex justify-center mt-3">
                                <span className="text-blue-500 text-3xl font-bold">{formatTime(orderData.status !== "pending" ? remainingTime : 0)}</span>
                            </div>
                        </div>
                    </div>
                    {/* Bottom navigation */}
                    <div className="flex justify-between mt-4 bg-gray-200 rounded-full">
                        {/* Clock (если null) */}
                        <div className="w-1/3 flex justify-center">
                            <div className={`rounded-full p-2 w-24 h-12 flex items-center justify-center
                    ${activeStatus === "pending" ? "bg-blue-500" : "bg-gray-200"}`}>
                                <img
                                    src={activeStatus === "pending" ? '/images/bottom_navigation_icons/clock.svg' : '/images/bottom_navigation_icons/clock_gray.svg'}
                                    alt='clock'
                                />
                            </div>
                        </div>

                        {/* In Progress */}
                        <div className="w-1/3 flex justify-center">
                            <div className={`rounded-full p-2 w-12 h-12 flex items-center justify-center
                    ${activeStatus === "in_progress" ? "bg-blue-500 w-28" : "bg-gray-200"}`}>
                                <img
                                    src='/images/bottom_navigation_icons/buble.svg'
                                    alt='buble'
                                    className={`${activeStatus === "in_progress" ? "filter brightness-0 invert" : ""}`}
                                />
                            </div>
                        </div>

                        {/* Completed */}
                        <div className="w-1/3 flex justify-center">
                            <div className={`rounded-full p-2 w-12 h-12 flex items-center justify-center
                    ${activeStatus === "completed" ? "bg-blue-500 w-28" : "bg-gray-200"}`}>
                                <img
                                    src='/images/bottom_navigation_icons/verified.svg'
                                    alt='verified'
                                    className={`${activeStatus === "completed" ? "filter brightness-0 invert" : ""}`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Отладочная панель в продакшене (показывается только при зажатии кнопки) */}
                <div className="mt-4">
                    <details className="bg-gray-100 rounded p-2">
                        <summary className="text-xs cursor-pointer">🔧 Debug Info</summary>
                        <div className="mt-2 text-xs space-y-1">
                            <div><strong>WebSocket ID:</strong> {websocketIdRef.current}</div>
                            <div><strong>Connected:</strong> {connected ? '✅' : '❌'}</div>
                            <div><strong>WS State:</strong> {debugInfo.websocketState}</div>
                            <div><strong>Attempts:</strong> {debugInfo.connectionAttempts}</div>
                            <div><strong>Server:</strong> {debugInfo.serverReachable ? '✅' : '❌'}</div>
                            {debugInfo.lastError && (
                                <div className="text-red-600"><strong>Error:</strong> {debugInfo.lastError}</div>
                            )}
                        </div>
                    </details>
                </div>

                {/* Status indicator */}
                {/* <div className={`text-center mt-3 text-xs font-medium px-3 py-1 rounded-full mx-auto w-fit ${getStatusClasses(orderData.status)}`}>
                    {getStatusText(orderData.status)}
                </div> */}
            </div>
        </div>
    );
};

export default HomeScreen;