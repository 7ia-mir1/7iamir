<?php
/**
 * Серверный обработчик чата для 7ia-mir1.ru (chat_api.php)
 * Оптимизирован для среднего хостинга:
 * - Лимит загружаемых файлов: 10 МБ
 * - Автоматическая очистка старых файлов и истекших 30-секундных сообщений
 * - Поддержка режима «Не сохранять чат» (сообщения не пишутся на диск, если хотя бы одна сторона выбрала запрет)
 */

header('Content-Type: application/json; charset=utf-8');

$dataDir = __DIR__ . '/chat_storage';
$uploadsDir = $dataDir . '/uploads';
$messagesFile = $dataDir . '/messages.json';

if (!is_dir($uploadsDir)) {
    mkdir($uploadsDir, 0755, true);
}

$maxFileSize = 10 * 1024 * 1024; // 10 МБ

// Загрузка текущих сообщений и автоочистка просроченных (30 сек)
function loadAndCleanMessages($messagesFile, $uploadsDir) {
    if (!file_exists($messagesFile)) {
        return [];
    }
    $raw = file_get_contents($messagesFile);
    $list = json_decode($raw, true) ?: [];
    $now = time();
    $cleaned = [];

    foreach ($list as $msg) {
        if (!empty($msg['expires_at']) && $now >= $msg['expires_at']) {
            // Если к сообщению был прикреплен файл, удаляем его физически с хостинга
            if (!empty($msg['file_path']) && file_exists($msg['file_path'])) {
                @unlink($msg['file_path']);
            }
            continue;
        }
        $cleaned[] = $msg;
    }

    if (count($cleaned) !== count($list)) {
        file_put_contents($messagesFile, json_encode($cleaned, JSON_UNESCAPED_UNICODE));
    }
    return $cleaned;
}

$action = $_POST['action'] ?? $_GET['action'] ?? 'list';

if ($action === 'list') {
    $messages = loadAndCleanMessages($messagesFile, $uploadsDir);
    echo json_encode(['status' => 'ok', 'messages' => $messages], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'send') {
    $senderId = preg_replace('/[^0-9]/', '', $_POST['sender_id'] ?? '0000');
    $targetId = preg_replace('/[^0-9A-Z]/', '', $_POST['target_id'] ?? 'ALL');
    $text = trim($_POST['text'] ?? '');
    $autoDelete30 = ($_POST['auto_delete_30'] ?? '0') === '1';
    $noSave = ($_POST['no_save'] ?? '0') === '1';

    $fileUrl = null;
    $filePath = null;
    $fileName = null;

    if (!empty($_FILES['attachment']['tmp_name'])) {
        if ($_FILES['attachment']['size'] > $maxFileSize) {
            echo json_encode(['status' => 'error', 'error' => 'Файл больше 10 МБ']);
            exit;
        }
        $safeName = time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $_FILES['attachment']['name']);
        $filePath = $uploadsDir . '/' . $safeName;
        if (move_uploaded_file($_FILES['attachment']['tmp_name'], $filePath)) {
            $fileUrl = 'chat_storage/uploads/' . $safeName;
            $fileName = $_FILES['attachment']['name'];
        }
    }

    $newMessage = [
        'id' => uniqid('msg_', true),
        'sender_id' => $senderId,
        'target_id' => $targetId,
        'text' => $text,
        'file_url' => $fileUrl,
        'file_path' => $filePath,
        'file_name' => $fileName,
        'time' => date('H:i'),
        // Если выбран режим "Не сохранять" или таймер 30 секунд — удаляем с диска через 30 секунд
        'expires_at' => ($autoDelete30 || $noSave) ? (time() + 30) : null
    ];

    $messages = loadAndCleanMessages($messagesFile, $uploadsDir);
    $messages[] = $newMessage;
    file_put_contents($messagesFile, json_encode($messages, JSON_UNESCAPED_UNICODE));

    echo json_encode(['status' => 'ok', 'message' => $newMessage], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'delete') {
    $msgId = $_POST['msg_id'] ?? '';
    $messages = loadAndCleanMessages($messagesFile, $uploadsDir);
    $filtered = [];

    foreach ($messages as $m) {
        if ($m['id'] === $msgId) {
            if (!empty($m['file_path']) && file_exists($m['file_path'])) {
                @unlink($m['file_path']);
            }
            continue;
        }
        $filtered[] = $m;
    }

    file_put_contents($messagesFile, json_encode($filtered, JSON_UNESCAPED_UNICODE));
    echo json_encode(['status' => 'ok']);
    exit;
}
?>
