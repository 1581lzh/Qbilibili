#!/bin/bash

APP_NAME="bilibili"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
NODE_USER="$(whoami)"
NODE_BIN="$(which node)"
PORT=3005

usage() {
    echo "用法: $0 {install|uninstall|start|stop|restart|status}"
    echo ""
    echo "  install   - 安装为 systemd 服务并设置开机自启"
    echo "  uninstall - 移除 systemd 服务"
    echo "  start     - 启动服务"
    echo "  stop      - 停止服务"
    echo "  restart   - 重启服务"
    echo "  status    - 查看服务状态"
}

install_service() {
    if [ "$(id -u)" -ne 0 ]; then
        echo "错误: 安装服务需要 root 权限，请使用 sudo"
        exit 1
    fi

    if [ ! -f "${APP_DIR}/package.json" ]; then
        echo "错误: 未找到 package.json，请在项目根目录执行"
        exit 1
    fi

    echo "==> 构建项目..."
    cd "${APP_DIR}"
    npm run build

    echo "==> 创建 systemd 服务文件..."
    cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Bilibili Video Platform
After=network.target

[Service]
Type=simple
User=${NODE_USER}
WorkingDirectory=${APP_DIR}
ExecStart=${NODE_BIN} ${APP_DIR}/node_modules/.bin/next start -p ${PORT} -H 0.0.0.0
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${PORT}

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${APP_NAME}
    systemctl start ${APP_NAME}

    echo "==> 服务安装完成"
    echo "    服务名称: ${APP_NAME}"
    echo "    监听端口: ${PORT}"
    echo "    访问地址: http://localhost:${PORT}"
    echo ""
    echo "常用命令:"
    echo "    sudo systemctl status ${APP_NAME}"
    echo "    sudo systemctl stop ${APP_NAME}"
    echo "    sudo systemctl restart ${APP_NAME}"
    echo "    sudo journalctl -u ${APP_NAME} -f    # 查看日志"
}

uninstall_service() {
    if [ "$(id -u)" -ne 0 ]; then
        echo "错误: 卸载服务需要 root 权限，请使用 sudo"
        exit 1
    fi

    systemctl stop ${APP_NAME} 2>/dev/null
    systemctl disable ${APP_NAME} 2>/dev/null
    rm -f "${SERVICE_FILE}"
    systemctl daemon-reload
    echo "==> 服务已卸载"
}

start_service() {
    if [ "$(id -u)" -ne 0 ]; then
        sudo systemctl start ${APP_NAME}
    else
        systemctl start ${APP_NAME}
    fi
    echo "==> 服务已启动"
}

stop_service() {
    if [ "$(id -u)" -ne 0 ]; then
        sudo systemctl stop ${APP_NAME}
    else
        systemctl stop ${APP_NAME}
    fi
    echo "==> 服务已停止"
}

restart_service() {
    if [ "$(id -u)" -ne 0 ]; then
        sudo systemctl restart ${APP_NAME}
    else
        systemctl restart ${APP_NAME}
    fi
    echo "==> 服务已重启"
}

status_service() {
    systemctl status ${APP_NAME}
}

case "$1" in
    install)   install_service ;;
    uninstall) uninstall_service ;;
    start)     start_service ;;
    stop)      stop_service ;;
    restart)   restart_service ;;
    status)    status_service ;;
    *)         usage ;;
esac
