#!/bin/bash

# Quick MySQL setup for FDC client
# This creates a minimal database that FDC client needs

echo "Setting up MySQL for FDC client..."

# Install MariaDB (drop-in MySQL replacement)
if ! command -v mysql &> /dev/null; then
    echo "Installing MariaDB..."
    sudo pacman -S --noconfirm mariadb
fi

# Initialize MariaDB if not already done
if [ ! -d /var/lib/mysql/mysql ]; then
    echo "Initializing MariaDB..."
    sudo mariadb-install-db --user=mysql --basedir=/usr --datadir=/var/lib/mysql
fi

# Start MariaDB service
echo "Starting MariaDB..."
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Wait for MariaDB to start
sleep 2

# Create database and user for FDC client
echo "Creating database..."
sudo mysql -u root << EOF
CREATE DATABASE IF NOT EXISTS flare_ftso_indexer;
GRANT ALL PRIVILEGES ON flare_ftso_indexer.* TO 'root'@'localhost' IDENTIFIED BY 'root';
FLUSH PRIVILEGES;
EOF

echo "✓ MySQL setup complete!"
echo ""
echo "Database: flare_ftso_indexer"
echo "Username: root"
echo "Password: root"
echo "Port: 3306"
echo ""
echo "You can now run the FDC client!"

