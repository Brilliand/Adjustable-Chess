forbiddenMoves = [
	function(board, move, from, to) {
		var newBoard = board.afterMove(move);
		var kingTile;
		for(var x = 0; x < newBoard.width; x++) {
			for(var y = 0; y < newBoard.height; y++) {
				var tile = newBoard.at(x, y);
				var piece = newBoard.tile(tile).piece;
				if(piece && piece.side == board.turn && piece.type == "king") {
					if(kingTile) return false;
					kingTile = tile;
				}
			}
		}
		return newBoard.isThreatened(kingTile);
	},
];
plausibleMoves = [
	function(board, move, from, to) {
		return from.isValid
		    && to.isValid
		    && from.piece
		    && from.piece.side == board.turn
		    && !(to.piece && to.piece.side == board.turn);
	},
];
allowedMoves = [
	function(board, move, from, to) {
		if(from.piece.type == "king") {
			return Math.abs(from.col - to.col) <= 1 && Math.abs(from.row - to.row) <= 1;
		}
	},
	function(board, move, from, to) {
		if(from.piece.type == "knight") {
			return Math.abs(from.col - to.col) * Math.abs(from.row - to.row) == 2;
		}
	},
	function(board, move, from, to) {
		if(from.piece.type == "bishop" || from.piece.type == "queen") {
			return Math.abs(from.col - to.col) == Math.abs(from.row - to.row) && board.path(move).empty;
		}
	},
	function(board, move, from, to) {
		if(from.piece.type == "rook" || from.piece.type == "queen") {
			return ((from.col == to.col) || (from.row == to.row)) && board.path(move).empty;
		}
	},
	function(board, move, from, to) {
		if(from.piece.type == "pawn") {
			if(from.piece.side == "white" && (to.row - from.row <= 0)) return false;
			if(from.piece.side == "black" && (to.row - from.row >= 0)) return false;
			if(to.col == from.col && from.row == 1 && to.row == 3) return board.path(move).empty && !to.piece;
			if(to.col == from.col && from.row == (board.height - 2) && to.row == (board.height - 4)) return board.path(move).empty && !to.piece;
			if(to.col == from.col && Math.abs(to.row - from.row) == 1) return !to.piece;
			if(Math.abs(to.col - from.col) == 1 && Math.abs(to.row - from.row) == 1) return to.piece;
		}
	},
	function(board, move, from, to) {
		if(from.piece.type == "king") {
			if(to.row == from.row && Math.abs(to.col - from.col) == 2) {
				if(board[from.piece.side+"KingMoved"]) return false;
				if(to.piece || !board.path(move).empty) return false;
				var rookFrom = board.at((to.col > from.col) ? (board.height - 1) : 0, from.row);
				if(board[rookFrom+"RookMoved"]) return false;
				var rook = board.tile(rookFrom).piece;
				if(typeof rook == "undefined" || rook.type != "rook" || rook.side != from.piece.side) return false;

				var newBoard = board.afterMove(move);
				if(newBoard.isThreatened(move.from)) return false;
				if(newBoard.isThreatened(board.path(move).tiles[0])) return false;
				if(newBoard.isThreatened(move.to)) return false;
				return true;
			}
		}
	},
	function(board, move, from, to) {
		if(from.piece.type == "pawn") {
			if(from.piece.side == "white" && (to.row - from.row <= 0)) return false;
			if(from.piece.side == "black" && (to.row - from.row >= 0)) return false;
			if(Math.abs(to.col - from.col) == 1 && Math.abs(to.row - from.row) == 1) return board.enPassant && board.enPassant.tiles.includes(move.to) && board.enPassant.piece.type == "pawn";
		}
	},
];
var moveSideEffects = [
	function(board, move, oldBoard) {
		if(oldBoard.turn == "white") board.turn = "black";
		if(oldBoard.turn == "black") board.turn = "white";
	},
	function(board, move, oldBoard) {
		board.enPassant = {
			tiles: board.path(move).tiles,
			piece: oldBoard.tile(move.from).piece,
			target: move.to,
		};
	},
	function(board, move, oldBoard) {
		if(oldBoard.enPassant && oldBoard.enPassant.tiles.includes(move.to)) {
			if(oldBoard.tile(move.from).piece.type == "pawn" && oldBoard.enPassant.piece.type == "pawn")
				delete board[oldBoard.enPassant.target];
		}
	},
	function(board, move, oldBoard) {
		var from = oldBoard.tile(move.from);
		var to = oldBoard.tile(move.to);
		if(from.piece && (from.piece.type == "king")) {
			if(to.row == from.row && Math.abs(to.col - from.col) == 2) {
				var rookFrom = oldBoard.at((to.col > from.col) ? (board.height - 1) : 0, from.row);
				var rookTo = oldBoard.path(move).tiles[0];
				board[rookTo] = board[rookFrom];
				delete board[rookFrom];
			}
			board[from.piece.side+"KingMoved"] = true;
		}
		if(from.piece && (from.piece.type == "rook")) {
			if( (from.col == 0 || from.col == board.width - 1)
			 && (from.row == 0 || from.row == board.height - 1) ) {
				board[move.from+"RookMoved"] = true;
			}
		}
	},
	function(board, move, oldBoard) {
		var to = board.tile(move.to);
		if(to.piece && to.piece.type == "pawn" && (to.row == 0 || to.row == board.height - 1)) {
			board[move.to] = {
				type: "queen",
				side: to.piece.side,
				promotedFrom: to.piece,
			}
		}
	},
];

pieceValues = {
	pawn: function(space) {
		var distance = (space.piece.side == "black" ? space.row : (board.height - space.row - 1));
		switch(distance) {
		case 4: return 1.1;
		case 3: return 1.5;
		case 2: return 2;
		case 1: return 3;
		case 0: return 9;
		default: return 1;
		}
	},
	knight: function(space) {
		if(space.col == 0) return 2.9;
		if(space.col == (board.width - 1)) return 2.9;
		if(space.row == 0) return 2.9;
		if(space.row == (board.height - 1)) return 2.9;
		return 3;
	},
	bishop: function(space) {
		if(space.row == 0) return 2.9;
		if(space.row == (board.height - 1)) return 2.9;
		return 3;
	},
	rook: 5,
	queen: 9,
};

board = new Board(8, 8);
for(var i = 0; i < board.width; i++) {
	board[board.at(i, 7)] = { type: backRow[i], side: "black" };
	board[board.at(i, 6)] = { type: "pawn", side: "black" };
	board[board.at(i, 1)] = { type: "pawn", side: "white" };
	board[board.at(i, 0)] = { type: backRow[i], side: "white" };
}
board.turn = "white";
visibleBoard.updateDisplay(board);

