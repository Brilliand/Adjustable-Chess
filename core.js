function Board(width, height) {
	this.width = width;
	this.height = height;
}
Board.prototype.tile = function(code) {
	var col = code.charCodeAt(0) - 'a'.charCodeAt(0);
	var row = code.charCodeAt(1) - '1'.charCodeAt(0);
	var data = {
		col: col,
		row: row,
		piece: this[code],
		isValid: (col >= 0) && (col < this.width) && (row >= 0) && (row < this.height) && code.length == 2,
	};
	return data;
};
Board.prototype.at = function(col, row) {
	return String.fromCharCode(col + 'a'.charCodeAt(0)) + String.fromCharCode(row + '1'.charCodeAt(0));
};
Board.prototype.path = function(move) {
	var result = {
		tiles: [],
		pieces: [],
		empty: true,
	};
	var from = this.tile(move.from);
	var to = this.tile(move.to);
	var dist = Math.max(Math.abs(from.col - to.col), Math.abs(from.row - to.row));
	var step = {
		col: (to.col - from.col) / dist,
		row: (to.row - from.row) / dist,
	};
	for(var i = 1; i < dist; i++) {
		var at = {
			col: from.col + step.col * i,
			row: from.row + step.row * i,
		};
		if(at.col % 1 == 0 && at.row % 1 == 0) {
			var tile = this.at(at.col, at.row);
			var piece = this.tile(tile).piece;
			result.tiles.push(tile);
			result.pieces.push(piece);
			if(piece) result.empty = false;
		}
	}
	return result;
};
Board.prototype.afterMove = function(move) {
	var next = Object.assign(new Board(this.width, this.height), this);
	if(move.to != move.from) {
		next[move.to] = next[move.from];
		delete next[move.from];
	}

	var board = this;
	moveSideEffects.map(function(callback) {
		callback(next, move, board);
	});

	return next;
};
Board.prototype.isMoveForbidden = function(move) {
	var forbidden = false;

	var board = this;
	var from = board.tile(move.from), to = board.tile(move.to);
	forbiddenMoves.map(function(callback) {
		if(forbidden) return;
		forbidden = callback(board, move, from, to);
	});

	return forbidden;
};
Board.prototype.isMoveAllowed = function(move) {

	var board = this;
	var from = board.tile(move.from), to = board.tile(move.to);

	var plausible = false;
	plausibleMoves.map(function(callback, i) {
		if(plausible) return;
		plausible = callback(board, move, from, to);
	});
	if(!plausible) return false;

	var allowed = false;
	allowedMoves.map(function(callback, i) {
		if(allowed) return;
		allowed = callback(board, move, from, to);
	});
	return allowed;
};
Board.prototype.isThreatened = function(target) {
	for(var from in this) {
		var threat = { from: from, to: target };
		if(this.isMoveAllowed(threat)) return true;
	}
	return false;
};
Board.prototype.getLegalMoves = function() {
	var legalMoves = [];
	for(var from in this) {
		var piece = this[from];
		if(piece && piece.side && piece.side == this.turn) {
			for(var x = 0; x < this.width; x++) {
				for(var y = 0; y < this.height; y++) {
					var to = this.at(x, y);
					var move = { from: from, to: to };
					if(this.isMoveAllowed(move) && !this.isMoveForbidden(move)) legalMoves.push(move);
				}
			}
		}
	}
	return legalMoves;
};
var pieceValues = {};
Board.prototype.score = function() {
	var score = 0;
	for(var tile in this) {
		var space = this.tile(tile);
		if(space.isValid && space.piece && pieceValues[space.piece.type]) {
			var value = pieceValues[space.piece.type];
			if(value instanceof Function) value = value(space);
			if(space.piece.side == this.turn) score += value;
			else score -= value;
		}
	}
	return score;
};

var forbiddenMoves = [];
var plausibleMoves = [];
var allowedMoves = [];
var moveSideEffects = [];

var backRow = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
var board = new Board(8, 8);

var visibleBoard = document.createElement("table");
visibleBoard.grid = {};
for(var y = board.height - 1; y >= 0; y--) {
	var row = document.createElement("tr");
	for(var x = 0; x < board.width; x++) {
		var cell = document.createElement("td");
		var tile = board.at(x, y);
		visibleBoard.grid[tile] = cell;
		cell.tileName = tile;
		cell.draggable = true;
		row.appendChild(cell);
	}
	visibleBoard.appendChild(row);
}
visibleBoard.addEventListener("dragstart", function(e) {
	if(e.target.tileName) {
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", e.target.className);
		this.elementBeingDragged = e.target;
	} else {
		e.preventDefault();
	}
});
visibleBoard.addEventListener("dragover", function(e) {
	if(e.target.tileName && this.elementBeingDragged) {
		e.preventDefault();
	}
});
visibleBoard.addEventListener("drop", function(e) {
	if(e.target.tileName && this.elementBeingDragged) {
		var move = {
			from: this.elementBeingDragged.tileName,
			to: e.target.tileName,
		};
		if(!board.isMoveAllowed(move)) console.log("Move not allowed", move);
		else if(board.isMoveForbidden(move)) console.log("Move forbidden", move);
		else {
			undoList.push(board);
			board = board.afterMove(move);
			visibleBoard.updateDisplay(board);
		}
	}
});
visibleBoard.addEventListener("dragend", function(e) {
	this.elementBeingDragged = null;
});
visibleBoard.updateDisplay = function(board) {
	for(var k in this.grid) {
		if(board[k]) {
			this.grid[k].className = board[k].side + " " + board[k].type;
		} else {
			this.grid[k].className = "";
		}
	}
	this.className = "chessboard " + board.turn + "tomove";
}
visibleBoard.updateDisplay(board);

var undoList = [];
var undoButton = document.createElement("button");
undoButton.innerText = "Undo";
undoButton.addEventListener("click", function() {
	if(undoList.length) {
		board = undoList.pop();
		visibleBoard.updateDisplay(board);
	}
});

var aiButton = document.createElement("button");
aiButton.innerText = "AI Move";
aiButton.addEventListener("click", function() {
	var progress = [];
	var alpha_beta = function(board, depth) {
		if(depth <= 0) {
			return {
				board: board,
				moves: [],
				score: board.score(),
			}
		}
		var favorSide = board.turn;
		var moves = board.getLegalMoves();
		if(moves.length == 0) {
			if(board.isMoveForbidden({from: "a1", to: "a1"})) {
				return {
					board: board,
					moves: [],
					score: -1000,
				}
			} else {
				return {
					board: board,
					moves: [],
					score: 0,
				}
			}
		}
		var subscore = board.score();
		return moves.map(function(move) {
			var outcome = alpha_beta(board.afterMove(move), depth - 1, i);
			return {
				board: outcome.board,
				moves: [move].concat(outcome.moves),
				score: subscore * 0.1 - outcome.score * 0.9,
			};
		}).sort(function(a, b) {
			return a.score - b.score;
		}).pop();
	}
	var allMoves = board.getLegalMoves();
	var allowedTime = 5000 / allMoves.length;
	var chosenMove = allMoves.map(function(move) {
		var until = performance.now() + allowedTime;
		var outcome;
		var i = 2;
		do {
			outcome = alpha_beta(board.afterMove(move), 2);
			i++;
		} while(performance.now() < until && outcome.moves.length > (i - 2));
		return {
			board: outcome.board,
			moves: [move].concat(outcome.moves),
			score: Math.random() * 0.1 - outcome.score,
		};
	}).sort(function(a, b) {
		return a.score - b.score;
	}).pop();
	if(!chosenMove) {
		alert("This game is over.");
		return;
	}
	var move = chosenMove.moves[0];
	console.log(chosenMove.moves, chosenMove.score);

	undoList.push(board);
	board = board.afterMove(move);
	visibleBoard.updateDisplay(board);
});

window.addEventListener("load", function() {
	document.body.appendChild(visibleBoard);
	document.body.appendChild(undoButton);
	document.body.appendChild(aiButton);
});

