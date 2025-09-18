"use client";

import React from "react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-900 text-white">
      <div className="bg-white text-slate-900 rounded-3xl p-6 max-w-md w-full">
        <div className="flex justify-center my-4">
          <div className="flex items-center">
            <div>
              <img src="/images/logo.svg" alt="logo" />
            </div>
          </div>
        </div>

        <h1 className="text-xl font-bold text-center mb-6">
          Отслеживание заказа
        </h1>

        <p className="text-gray-600 text-center mb-8">
          Отсканируйте QR-код, чтобы отслеживать статус вашего заказа в реальном
          времени
        </p>
      </div>
    </div>
  );
}
