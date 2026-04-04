interface Props {
  email: string;
  onLogout: () => void;
  onClose: () => void;
}

export default function AccountPanel({ email, onLogout, onClose }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-gray-900 dark:text-white font-semibold">アカウント</h2>

      <div>
        <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">ログイン中のアカウント</div>
        <div className="bg-gray-100 dark:bg-gray-700 rounded px-3 py-2 text-gray-900 dark:text-white text-sm break-all">
          {email}
        </div>
      </div>

      <div className="flex gap-2 mt-2">
        <button
          onClick={onLogout}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-medium text-sm"
        >
          ログアウト
        </button>
        <button
          onClick={onClose}
          className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-2 rounded font-medium text-sm"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
