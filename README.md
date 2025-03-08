# 方块工匠：远古机关师 (Block Craftsman: Ancient Mechanic)

A browser-based simulation game where you control vehicles and cranes to manipulate blocks in a 2D world. Build, transport, and manage resources while navigating terrain challenges.

![Game Screenshot](screenshot.png)

## Features

- **Dynamic 2D World**: Interact with different block types including dirt, stone, and trees
- **Machinery Control**: Operate vehicles and cranes with unique capabilities
- **Resource Management**: Harvest trees for wood to build new machinery
- **Physics Simulation**: Experience realistic movement constraints and support surfaces
- **Machine Interactions**: Load and unload blocks between machines, terrain, and the world

## Gameplay Mechanics

### Block Types
- **Air**: Empty space that machines can pass through
- **Dirt**: Basic terrain block, serves as a support surface
- **Stone**: Solid terrain block, serves as a support surface
- **Tree**: Can be harvested for wood resources
- **Wood**: Resource used to create vehicles and cranes

### Machines

#### Vehicles
- Cost: 1 wood
- Can move horizontally on supported surfaces
- Can climb up or down by one block if the terrain allows
- Can carry one block at a time
- Can pass through unloaded crane hooks and bases

#### Cranes
- Cost: 2 wood
- Have a fixed base and a movable hook
- The hook can move up and down
- Both the base and hook can hold one block
- Can transfer blocks between the world, vehicles, and other cranes

### Movement Rules
- Vehicles need support underneath (terrain or loaded crane bases)
- Vehicles can climb up or down by one block if there's appropriate terrain
- Vehicles can pass through unloaded crane components
- Crane hooks can move freely when unloaded, but when loaded they cannot pass through solid objects

### Resource System
- Harvesting trees provides wood
- Wood is used to create new vehicles (1 wood) and cranes (2 wood)
- Demolishing machines returns their wood cost
- Trees will naturally grow near existing trees
- Tree growth occurs every 10 operations
- Growth probability increases with the number of existing trees

## Controls

### Vehicle Controls
- Move Left: A
- Move Right: D
- Load from Left: Q
- Load from Right: E
- Unload to Left: Z
- Unload to Right: C
- Smart Load (prioritizing trees): R
- Smart Unload (same direction): F
- Smart Unload (opposite direction): V
- Demolish: X

### Crane Controls
- Move Hook Up: W
- Move Hook Down: S
- Attach Block: R
- Detach Block: F
- Demolish: X (hook must be at base level and unloaded)

## Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)

### Installation
1. Clone the repository:
   ```
   git clone https://github.com/ZoukiLi/block-craftsman-ancient-mechanic.git
   ```
2. Open the `index.html` file in your browser

### Playing Online
Visit [game website URL] to play directly in your browser without installation.

## Game Interface

- **Game World**: The main play area showing blocks, vehicles, and cranes
- **Resources Panel**: Displays available wood resources
- **Machine List**: Shows all your machines and their current status
- **Controls Panel**: Contains buttons for creating machines and controlling the selected machine
- **Message Area**: Provides feedback on game actions
- **Operation Counter**: Tracks the number of operations performed

## Advanced Mechanics

- **Machine Selection**: Click on a machine to select it and display its controls
- **Machine Creation**: Use wood resources to create vehicles and cranes
- **Tree Growth**: Trees will occasionally grow near existing trees
- **Machine Overlaps**: Indicators show when machines are overlapping, which may affect functionality
- **Safety Checks**: Physical safety systems prevent actions that would cause unsupported vehicles
- **Smart Loading/Unloading**: Smart loading prioritizes trees, then blocks based on movement direction

## Development

This game is built using:
- HTML5
- CSS3
- Vanilla JavaScript

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by various block-based and construction simulation games
- Special thanks to all contributors and testers
